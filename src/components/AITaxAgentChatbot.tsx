/**
 * AI Tax Agent Chatbot Component
 * Provides AI-powered tax advice using Gemini AI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Loader2, Sparkles, RotateCcw, BookOpen } from 'lucide-react';
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
import { loadLegislationJSON, AVAILABLE_LEGISLATION } from '@/utils/legislationLoader';

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

// Message content renderer with proper markdown formatting
function MessageContent({ content }: { readonly content: string }) {
  const renderLine = (line: string, index: number) => {
    // Skip empty lines
    if (!line.trim()) {
      return <div key={index} className="h-2" />;
    }

    // Headers (# ## ###)
    const h1Regex = /^# (.+)$/;
    const h1Match = h1Regex.exec(line);
    if (h1Match) {
      return <h1 key={index} className="text-2xl font-bold mb-3 mt-4 text-gray-900">{h1Match[1]}</h1>;
    }
    
    const h2Regex = /^## (.+)$/;
    const h2Match = h2Regex.exec(line);
    if (h2Match) {
      return <h2 key={index} className="text-xl font-bold mb-2 mt-3 text-gray-800">{h2Match[1]}</h2>;
    }
    
    const h3Regex = /^### (.+)$/;
    const h3Match = h3Regex.exec(line);
    if (h3Match) {
      return <h3 key={index} className="text-lg font-semibold mb-2 mt-2 text-gray-700">{h3Match[1]}</h3>;
    }

    // Bold text (**text**)
    const boldRegex = /^\*\*(.+)\*\*:?(.*)$/;
    const boldMatch = boldRegex.exec(line);
    if (boldMatch) {
      return (
        <p key={index} className="mb-2">
          <strong className="font-semibold text-gray-900">{boldMatch[1]}</strong>
          {boldMatch[2] && <span>{boldMatch[2]}</span>}
        </p>
      );
    }

    // Bullet points (- or *)
    const bulletRegex = /^[*-]\s+/;
    if (bulletRegex.test(line)) {
      const bulletContent = line.replace(bulletRegex, '');
      return (
        <li key={index} className="ml-4 mb-1 text-gray-700">
          {formatInlineText(bulletContent)}
        </li>
      );
    }

    // Numbered lists (1. 2. etc)
    const numberedRegex = /^(\d+)\.\s+(.+)$/;
    const numberedMatch = numberedRegex.exec(line);
    if (numberedMatch) {
      return (
        <li key={index} className="ml-4 mb-1 text-gray-700" style={{ listStyleType: 'decimal' }}>
          {formatInlineText(numberedMatch[2])}
        </li>
      );
    }

    // Regular paragraph with inline formatting
    return (
      <p key={index} className="mb-2 text-gray-700 leading-relaxed">
        {formatInlineText(line)}
      </p>
    );
  };

  const formatInlineText = (text: string) => {
    // Handle **bold**, `code`, and regular text
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    
    return parts.map((part, i) => {
      const key = `${text.slice(0, 10)}-${i}`; // Use content prefix + index for more stable keys
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={key} className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-purple-700">{part.slice(1, -1)}</code>;
      }
      return <span key={key}>{part}</span>;
    });
  };

  const lines = content.split('\n');
  
  return (
    <div className="prose prose-sm max-w-none">
      {lines.map((line, index) => renderLine(line, index))}
    </div>
  );
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

  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedTaxYear, setSelectedTaxYear] = useState(defaultTaxYear || currentTaxYear);
  const [selectedModel, setSelectedModel] = useState(geminiModel);
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string; description: string }>>([...FALLBACK_GEMINI_MODELS]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [legislationLoaded, setLegislationLoaded] = useState(false);
  const [legislationText, setLegislationText] = useState<string>('');
  const [loadingLegislation, setLoadingLegislation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedLegislationRef = useRef(false);
  const isLoadingLegislationRef = useRef(false);
  const initialModelRef = useRef<string>(geminiModel);

  // Initialize selectedEntityId after entities are loaded
  useEffect(() => {
    if (entities.length > 0 && !selectedEntityId) {
      const initialEntityId = defaultEntityId || entities[0]?.id || '';
      setSelectedEntityId(initialEntityId);
    }
  }, [entities, defaultEntityId, selectedEntityId]);

  // Debug: Track component lifecycle
  useEffect(() => {
    console.log('🔵 AITaxAgentChatbot mounted');
    return () => {
      console.log('🔴 AITaxAgentChatbot unmounted');
    };
  }, []);

  // Load legislation from pre-extracted JSON files (fast, no API call)
  const loadLegislation = useCallback(async (modelToUse: string) => {
    // Use refs to avoid dependency on state variables
    if (!geminiApiKey) {
      console.log('❌ Load legislation aborted: No API key');
      return;
    }
    if (hasLoadedLegislationRef.current) {
      console.log('❌ Load legislation aborted: Already loaded');
      return;
    }
    if (isLoadingLegislationRef.current) {
      console.log('❌ Load legislation aborted: Already loading');
      return;
    }
    if (AVAILABLE_LEGISLATION.length === 0) {
      console.log('❌ Load legislation aborted: No legislation configured');
      return;
    }

    console.log('✅ Starting legislation load (pre-extracted JSON)');
    hasLoadedLegislationRef.current = true; // Prevent multiple calls
    isLoadingLegislationRef.current = true;
    setLoadingLegislation(true);
    
    try {
      // Load the first available legislation (pre-extracted JSON)
      const mainAct = AVAILABLE_LEGISLATION[0];
      console.log('📄 Loading JSON from:', mainAct.path);
      const text = await loadLegislationJSON(mainAct.path);
      console.log('✅ JSON loaded, text length:', text.length);
      setLegislationText(text);
      setLegislationLoaded(true);
      console.log('✅ Legislation loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load legislation:', error);
      // Continue without legislation - chatbot will work with general knowledge
      setLegislationLoaded(true); // Mark as "loaded" to unblock the button
    } finally {
      setLoadingLegislation(false);
      isLoadingLegislationRef.current = false;
      console.log('🏁 Legislation loading process complete');
    }
  }, [geminiApiKey]);

  // Fetch available Gemini models first, then load legislation
  useEffect(() => {
    console.log('Main effect triggered:', { geminiApiKey: !!geminiApiKey, open, hasLoaded: hasLoadedLegislationRef.current });
    
    if (geminiApiKey && open && !hasLoadedLegislationRef.current) {
      setLoadingModels(true);
      fetchAvailableGeminiModels(geminiApiKey)
        .then((models) => {
          if (models.length > 0) {
            setAvailableModels(models);
          }
          return models;
        })
        .catch((err) => {
          console.error('Failed to fetch Gemini models:', err);
          return [];
        })
        .finally(() => {
          setLoadingModels(false);
        })
        .then(() => {
          // Load legislation AFTER models are fetched, using the default model from settings
          console.log('Models loaded, now loading legislation with model:', initialModelRef.current);
          loadLegislation(initialModelRef.current);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        id: 'no-api-key-' + Date.now(),
        role: 'assistant',
        content: '⚠️ Gemini API key is not configured. Please set up your API key in Settings to use the AI Tax Agent.',
        timestamp: new Date()
      }]);
      setShowConfig(false);
    }
  }, [open, geminiApiKey]);

  // Reset legislation ref when dialog is fully closed
  useEffect(() => {
    if (!open) {
      // Reset the refs when dialog closes to allow re-loading next time
      console.log('Dialog closed - resetting legislation state');
      hasLoadedLegislationRef.current = false;
      isLoadingLegislationRef.current = false;
      setLegislationLoaded(false);
      setLegislationText('');
      setLoadingLegislation(false);
    }
  }, [open]);

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

      const legislationContext = legislationLoaded 
        ? `\n\n**CRITICAL INSTRUCTION - LEGISLATION REFERENCE:**\nYou have been provided with the COMPLETE text of the Inland Revenue Act No. 24 of 2017 below. You MUST base ALL your tax advice, calculations, rates, and recommendations EXCLUSIVELY on this provided legislation text. DO NOT use general knowledge or training data about Sri Lankan tax law.\n\nWhen citing the Act:\n1. Quote the exact text from the legislation provided below\n2. Include the specific section number (e.g., "Section 3 states: '[exact quote]'")\n3. If a section is not found in the provided text, explicitly state "This information is not available in the provided legislation"\n4. Never assume or infer tax rules not explicitly stated in the text below\n\n--- BEGIN INLAND REVENUE ACT NO. 24 OF 2017 ---\n${legislationText.slice(0, 30000)}\n--- END LEGISLATION EXCERPT ---\n\nIMPORTANT: Base your entire analysis on the legislation text provided above. Cite specific sections with exact quotes.`
        : '\n\n**Note:** Legislation not loaded. Providing general guidance only - taxpayer should verify all information with official IRD sources.';

      const prompt = `You are an expert Sri Lankan tax advisor. Analyze the following taxpayer's financial situation and provide a comprehensive tax advisory report.\n\nIMPORTANT: If legislation is loaded, you MUST cite specific sections from the provided Inland Revenue Act text with exact quotes. Do not rely on general knowledge.

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
${legislationContext}

Please provide a well-structured analysis using this format:

## 1. Tax Compliance Status
[Brief assessment of compliance - are they on track? Any immediate concerns?]

## 2. Audit Risk Analysis
[Explain the ${context.auditRisk.level} risk level and what's causing it]

## 3. Tax Optimization Opportunities
[Specific legal ways to reduce tax liability - use bullet points]
- Opportunity 1
- Opportunity 2

## 4. Pre-Filing Recommendations
[Action items they should complete before filing]
1. Action item 1
2. Action item 2

## 5. Potential Red Flags
[Issues that might trigger an audit - be specific]
- Red flag 1
- Red flag 2

Use **bold text** for important terms and numbers. Keep paragraphs concise and actionable.`;

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

  const handleNewChat = () => {
    // Reset to configuration screen
    setShowConfig(true);
    setMessages([]);
    setInputMessage('');
    setIsAnalyzing(false);
    setIsSending(false);
    // Don't reset legislation - keep it loaded for next chat
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

      const legislationContext = legislationLoaded 
        ? `\n\n**CRITICAL INSTRUCTION - LEGISLATION REFERENCE:**\nYou have been provided with the COMPLETE text of the Inland Revenue Act No. 24 of 2017 below. You MUST answer the user's question EXCLUSIVELY based on this provided legislation text. DO NOT use general knowledge.\n\nWhen answering:\n1. Search the provided legislation text for relevant sections\n2. Quote exact text from the legislation (e.g., "Section 52 states: '[exact quote]'")\n3. If the answer is not in the provided text, say "The provided legislation does not cover this topic"\n4. Never make up or assume tax rules not in the text below\n\n--- BEGIN INLAND REVENUE ACT NO. 24 OF 2017 ---\n${legislationText.slice(0, 20000)}\n--- END LEGISLATION EXCERPT ---\n\nYou MUST base your answer on the above legislation text with specific citations and quotes.`
        : '\n\n**Note:** Legislation not loaded. Providing general guidance only.';

      const prompt = `You are an expert Sri Lankan tax advisor helping a taxpayer with their ${context.taxYear} tax filing.\n\nCRITICAL: If legislation text is provided above, you MUST:\n- Answer based ONLY on that exact text\n- Quote specific sections with exact wording\n- State clearly if information is not in the provided legislation\n- Never rely on general knowledge when legislation is provided\n\n**Current Financial Context:**\n- Income: ${context.income.total}\n- Assets: ${context.assets.totalValue}\n- Tax Payable: ${context.tax.taxPayable}\n- Audit Risk: ${context.auditRisk.level.toUpperCase()}\n${legislationContext}\n\n**Previous Conversation:**\n${conversationHistory}\n\n**User's Question:**\n${inputMessage}\n\nProvide a helpful, accurate response. Format your response clearly:\n- Use **bold** for important terms and amounts\n- Use bullet points (-) for lists\n- Use numbered lists (1. 2.) for step-by-step instructions\n- Keep paragraphs concise and actionable\n- Include specific numbers and references when relevant\n- ALWAYS cite legislation sections with exact quotes (e.g., 'Section 3 of the Inland Revenue Act states: "[exact text]"')\n- If using the provided legislation, quote the exact text, don't paraphrase\n\nBe specific and explain tax implications of any recommendations.`;

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <DialogTitle>AI Tax Agent - Sri Lankan Tax Advisory</DialogTitle>
            </div>
            {!showConfig && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleNewChat}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                New Chat
              </Button>
            )}
          </div>
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

            {/* Legislation Status */}
            {loadingLegislation ? (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2">
                  <Loader2 className="w-4 h-4 mt-0.5 text-blue-600 animate-spin" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">Loading Tax Legislation...</p>
                    <p className="text-blue-600">
                      Loading Inland Revenue Act from pre-extracted file...
                    </p>
                  </div>
                </div>
              </div>
            ) : legislationText ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 mt-0.5 text-green-600" />
                  <div className="text-xs text-green-700">
                    <p className="font-medium mb-1">Tax Legislation Ready</p>
                    <p className="text-green-600">
                      AI will reference Inland Revenue Act No. 24 of 2017 with specific section citations.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 mt-0.5 text-amber-600" />
                  <div className="text-xs text-amber-700">
                    <p className="font-medium mb-1">Tax Legislation Unavailable</p>
                    <p className="text-amber-600">
                      Place PDF files in public/tax-legislation/ folder to enable legislation references.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                        <div className="mt-2">
                          <MessageContent content={message.content} />
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
                <Button 
                  variant="outline"
                  onClick={handleNewChat}
                  disabled={isSending || isAnalyzing}
                  title="Start a new chat for a different entity or tax year"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Tax Year: {formatTaxYear(selectedTaxYear)} | Model: {availableModels.find(m => m.value === selectedModel)?.label}
                </span>
                <button
                  onClick={handleNewChat}
                  className="text-purple-600 hover:text-purple-700 hover:underline"
                  disabled={isSending || isAnalyzing}
                >
                  Change entity/year
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
