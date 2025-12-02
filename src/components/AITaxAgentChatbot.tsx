/**
 * AI Tax Agent Chatbot Component
 * Provides AI-powered tax advice using Gemini AI
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateAuditRisk, formatLKR, computeTax } from '@/lib/taxEngine';
import { formatTaxYear } from '@/lib/taxYear';
import { fetchAvailableGeminiModels, FALLBACK_GEMINI_MODELS } from '@/utils/geminiPdfParser';

interface AITaxAgentChatbotProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly defaultEntityId?: string;
  readonly defaultTaxYear?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AITaxAgentChatbot({ 
  open, 
  onClose, 
  defaultEntityId, 
  defaultTaxYear 
}: AITaxAgentChatbotProps) {
  const entities = useStore((state) => state.entities);
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const certificates = useStore((state) => state.certificates);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const geminiModel = useStore((state) => state.geminiModel);
  const setGeminiModel = useStore((state) => state.setGeminiModel);

  const [selectedEntityId, setSelectedEntityId] = useState(defaultEntityId || entities[0]?.id || '');
  const [selectedTaxYear, setSelectedTaxYear] = useState(defaultTaxYear || currentTaxYear);
  const [selectedModel, setSelectedModel] = useState(geminiModel);
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string; description: string }>>([...FALLBACK_GEMINI_MODELS]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch available Gemini models on mount
  useEffect(() => {
    if (geminiApiKey && open) {
      setLoadingModels(true);
      fetchAvailableGeminiModels(geminiApiKey)
        .then((models) => {
          if (models.length > 0) {
            setAvailableModels(models);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch Gemini models:', err);
        })
        .finally(() => {
          setLoadingModels(false);
        });
    }
  }, [geminiApiKey, open]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && !geminiApiKey) {
      setMessages([{
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: '⚠️ Gemini API key is not configured. Please set up your API key in Settings to use the AI Tax Agent.',
        timestamp: new Date()
      }]);
      setShowConfig(false);
    }
  }, [open, geminiApiKey]);

  const generateFinancialContext = () => {
    const entity = entities.find(e => e.id === selectedEntityId);
    const entityAssets = assets.filter(a => a.ownerId === selectedEntityId);
    const entityLiabilities = liabilities.filter(l => l.ownerId === selectedEntityId);
    const entityIncomes = incomes.filter(i => i.ownerId === selectedEntityId && i.taxYear === selectedTaxYear);
    const entityCertificates = certificates.filter(c => c.ownerId === selectedEntityId && c.taxYear === selectedTaxYear);

    // Calculate audit risk
    const auditRisk = calculateAuditRisk(entityAssets, entityLiabilities, entityIncomes, selectedTaxYear);
    
    // Calculate tax
    const taxComputation = computeTax(entityIncomes, entityAssets, selectedTaxYear);

    return {
      taxpayer: {
        name: entity?.name || 'Unknown',
        tin: entity?.tin || 'N/A',
        role: entity?.role || 'primary'
      },
      taxYear: formatTaxYear(selectedTaxYear),
      income: {
        employment: formatLKR(auditRisk.employmentIncome),
        business: formatLKR(auditRisk.businessIncome),
        investment: formatLKR(auditRisk.investmentIncome),
        total: formatLKR(auditRisk.totalIncome),
        taxDeducted: formatLKR(auditRisk.taxDeducted)
      },
      assets: {
        count: entityAssets.length,
        totalValue: formatLKR(entityAssets.reduce((sum, a) => sum + (a.financials.marketValue || 0), 0)),
        growth: formatLKR(auditRisk.assetGrowth)
      },
      liabilities: {
        count: entityLiabilities.length,
        total: formatLKR(entityLiabilities.reduce((sum, l) => sum + l.currentBalance, 0)),
        newLoans: formatLKR(auditRisk.newLoans),
        payments: formatLKR(auditRisk.loanPayments)
      },
      tax: {
        taxableIncome: formatLKR(taxComputation.taxableIncome),
        taxPayable: formatLKR(taxComputation.taxPayable),
        taxCredits: formatLKR(taxComputation.taxCredits.apit + taxComputation.taxCredits.wht),
        netTax: formatLKR(taxComputation.taxPayable - (taxComputation.taxCredits.apit + taxComputation.taxCredits.wht))
      },
      auditRisk: {
        level: auditRisk.riskLevel,
        score: formatLKR(Math.abs(auditRisk.riskScore)),
        message: auditRisk.riskScore > 0 ? 'Unexplained wealth detected' : 'Financial records balanced'
      },
      certificates: {
        count: entityCertificates.length,
        totalWithheld: formatLKR(entityCertificates.reduce((sum, c) => sum + c.details.taxDeducted, 0))
      }
    };
  };

  const performInitialAnalysis = async () => {
    if (!geminiApiKey) return;

    setIsAnalyzing(true);
    setShowConfig(false);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: selectedModel });

      const context = generateFinancialContext();

      const prompt = `You are an expert Sri Lankan tax advisor. Analyze the following taxpayer's financial situation and provide a comprehensive tax advisory report.

**Taxpayer Information:**
- Name: ${context.taxpayer.name}
- TIN: ${context.taxpayer.tin}
- Tax Year: ${context.taxYear}
- Role: ${context.taxpayer.role}

**Income Summary:**
- Employment Income: ${context.income.employment}
- Business Income: ${context.income.business}
- Investment Income: ${context.income.investment}
- Total Income: ${context.income.total}
- Tax Already Deducted: ${context.income.taxDeducted}

**Assets:**
- Total Assets: ${context.assets.count} items worth ${context.assets.totalValue}
- Asset Growth This Year: ${context.assets.growth}

**Liabilities:**
- Total Liabilities: ${context.liabilities.count} loans totaling ${context.liabilities.total}
- New Loans Taken: ${context.liabilities.newLoans}
- Loan Payments Made: ${context.liabilities.payments}

**Tax Computation:**
- Taxable Income: ${context.tax.taxableIncome}
- Tax Payable: ${context.tax.taxPayable}
- Tax Credits (APIT/WHT): ${context.tax.taxCredits}
- Net Tax to Pay/Refund: ${context.tax.netTax}

**Audit Risk Assessment:**
- Risk Level: ${context.auditRisk.level.toUpperCase()}
- Risk Score: ${context.auditRisk.score}
- Status: ${context.auditRisk.message}

**Tax Certificates:**
- Certificates Filed: ${context.certificates.count}
- Total Tax Withheld: ${context.certificates.totalWithheld}

Please provide:
1. **Tax Compliance Status**: Are they compliant? Any immediate concerns?
2. **Audit Risk Analysis**: Explain the risk level and what's causing it
3. **Optimization Opportunities**: How can they reduce their tax liability legally?
4. **Recommendations**: Specific actions they should take before filing
5. **Red Flags**: Any potential issues that might trigger an audit

Keep your response professional, clear, and actionable. Use bullet points for clarity.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const analysisText = response.text();

      setMessages([
        {
          id: 'analysis-' + Date.now(),
          role: 'assistant',
          content: `# 📊 Initial Tax Analysis - ${context.taxYear}\n\n${analysisText}`,
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      console.error('Analysis error:', error);
      setMessages([
        {
          id: 'error-' + Date.now(),
          role: 'assistant',
          content: `❌ Error performing analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartChat = () => {
    // Save selected model to store
    setGeminiModel(selectedModel);
    performInitialAnalysis();
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !geminiApiKey || isSending) return;

    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: selectedModel });

      const context = generateFinancialContext();
      
      // Build conversation history
      const conversationHistory = messages.map(m => 
        `${m.role === 'user' ? 'User' : 'Tax Advisor'}: ${m.content}`
      ).join('\n\n');

      const prompt = `You are an expert Sri Lankan tax advisor helping a taxpayer with their ${context.taxYear} tax filing.

**Current Financial Context:**
Income: ${context.income.total} | Assets: ${context.assets.totalValue} | Tax Payable: ${context.tax.taxPayable} | Audit Risk: ${context.auditRisk.level}

**Previous Conversation:**
${conversationHistory}

**User's New Question:**
${inputMessage}

Provide a helpful, accurate response based on Sri Lankan tax law. Be specific and actionable. If recommending actions, explain the tax implications.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const aiResponse = response.text();

      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Tax Agent - Sri Lankan Tax Advisory
          </DialogTitle>
          <DialogDescription>
            Get personalized tax advice powered by Gemini AI
          </DialogDescription>
        </DialogHeader>

        {showConfig ? (
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="entity">Select Entity</Label>
              <select
                id="entity"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                {entities.map(entity => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.tin})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="taxYear">Tax Year</Label>
              <select
                id="taxYear"
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                {['2024', '2023', '2022', '2021', '2020'].map(year => (
                  <option key={year} value={year}>
                    {formatTaxYear(year)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="model">AI Model</Label>
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                disabled={loadingModels}
              >
                {availableModels.map(model => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {loadingModels ? 'Loading available models...' : availableModels.find(m => m.value === selectedModel)?.description || 'Select AI model for analysis'}
              </p>
            </div>

            <Button 
              onClick={handleStartChat} 
              className="w-full"
              disabled={!geminiApiKey || !selectedEntityId}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Tax Analysis
            </Button>
          </div>
        ) : (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-[400px] max-h-[500px]">
              {isAnalyzing ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-600" />
                    <p className="text-sm text-muted-foreground">Analyzing your tax situation...</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <Card key={message.id} className={message.role === 'user' ? 'ml-12 bg-blue-50' : 'mr-12 bg-purple-50'}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`font-semibold text-sm ${message.role === 'user' ? 'text-blue-600' : 'text-purple-600'}`}>
                            {message.role === 'user' ? '👤 You' : '🤖 Tax Advisor'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="mt-2 prose prose-sm max-w-none">
                          {message.content.split('\n').map((line, i) => (
                            <p key={`${message.id}-line-${i}`} className="mb-2">{line}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a tax question..."
                  disabled={isSending || isAnalyzing || !geminiApiKey}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputMessage.trim() || isSending || isAnalyzing || !geminiApiKey}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Tax Year: {formatTaxYear(selectedTaxYear)} | Model: {availableModels.find(m => m.value === selectedModel)?.label}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
