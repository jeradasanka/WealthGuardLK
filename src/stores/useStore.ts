/**
 * Main Zustand store for application state
 * Manages entities, assets, liabilities, incomes, and persistence
 */

import { create } from 'zustand';
import type { AppState, TaxEntity, Asset, Liability, Income, AITWHTCertificate, FinancialAssetBalance, LiabilityPayment, ValuationEntry } from '@/types';
import { saveState, loadState } from '@/utils/storage';
import { getCurrentTaxYear } from '@/lib/taxYear';

interface StoreState extends AppState {
  passphrase: string | null;
  useAiParsing: boolean;
  geminiApiKey: string;
  geminiModel: string;
  
  // Actions
  setPassphrase: (passphrase: string) => void;
  setUseAiParsing: (enabled: boolean) => void;
  setGeminiApiKey: (apiKey: string) => void;
  setGeminiModel: (model: string) => void;
  
  // Entity actions
  addEntity: (entity: TaxEntity) => void;
  updateEntity: (id: string, updates: Partial<TaxEntity>) => void;
  removeEntity: (id: string) => void;
  
  // Asset actions
  addAsset: (asset: Asset) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  disposeAsset: (id: string, date: string, salePrice: number) => void;
  closeFinancialAsset: (id: string, date: string, finalBalance: number) => void;
  addBalanceToAsset: (assetId: string, balance: FinancialAssetBalance) => void;
  removeBalanceFromAsset: (assetId: string, balanceId: string) => void;
  addValuationToAsset: (assetId: string, valuation: ValuationEntry) => void;
  removeValuationFromAsset: (assetId: string, valuationId: string) => void;
  updateValuationInAsset: (assetId: string, valuationId: string, updates: Partial<ValuationEntry>) => void;
  
  // Liability actions
  addLiability: (liability: Liability) => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  removeLiability: (id: string) => void;
  addPaymentToLiability: (liabilityId: string, payment: LiabilityPayment) => void;
  removePaymentFromLiability: (liabilityId: string, paymentId: string) => void;
  
  // Income actions
  addIncome: (income: Income) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  removeIncome: (id: string) => void;
  
  // Certificate actions
  addCertificate: (certificate: AITWHTCertificate) => void;
  updateCertificate: (id: string, updates: Partial<AITWHTCertificate>) => void;
  removeCertificate: (id: string) => void;
  
  // Joint asset split ratio
  setJointAssetSplit: (entityId: string, percentage: number) => void;
  
  // Tax year
  setCurrentTaxYear: (year: string) => void;
  
  // Persistence
  saveToStorage: () => Promise<void>;
  loadFromStorage: (passphrase: string) => Promise<void>;
  resetState: () => void;
}

const initialState: AppState = {
  entities: [],
  assets: [],
  liabilities: [],
  incomes: [],
  certificates: [],
  currentTaxYear: getCurrentTaxYear(),
  jointAssetSplitRatio: {},
  isEncrypted: false,
};

export const useStore = create<StoreState>((set, get) => ({
  ...initialState,
  passphrase: null,
  useAiParsing: localStorage.getItem('useAiParsing') === 'true',
  geminiApiKey: localStorage.getItem('geminiApiKey') || '',
  geminiModel: localStorage.getItem('geminiModel') || 'gemini-2.0-flash-exp',
  
  setPassphrase: (passphrase) => set({ passphrase }),
  
  setUseAiParsing: (enabled) => {
    set({ useAiParsing: enabled });
    localStorage.setItem('useAiParsing', enabled ? 'true' : 'false');
  },
  
  setGeminiApiKey: (apiKey) => {
    set({ geminiApiKey: apiKey });
    localStorage.setItem('geminiApiKey', apiKey);
  },
  
  setGeminiModel: (model) => {
    set({ geminiModel: model });
    localStorage.setItem('geminiModel', model);
  },
  
  // Entity actions
  addEntity: (entity) =>
    set((state) => ({
      entities: [...state.entities, entity],
    })),
    
  updateEntity: (id, updates) =>
    set((state) => ({
      entities: state.entities.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),
    
  removeEntity: (id) =>
    set((state) => ({
      entities: state.entities.filter((e) => e.id !== id),
    })),
  
  // Asset actions
  addAsset: (asset) =>
    set((state) => ({
      assets: [...state.assets, asset],
    })),
    
  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
    
  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    })),
    
  disposeAsset: (id, date, salePrice) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, disposed: { date, salePrice } } : a
      ),
    })),

  closeFinancialAsset: (id, date, finalBalance) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, closed: { date, finalBalance }, financials: { ...a.financials, marketValue: 0 } } : a
      ),
    })),
  
  addBalanceToAsset: (assetId, balance) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId 
          ? { ...a, balances: [...(a.balances || []), balance] }
          : a
      ),
    })),
  
  removeBalanceFromAsset: (assetId, balanceId) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId 
          ? { ...a, balances: (a.balances || []).filter(b => b.id !== balanceId) }
          : a
      ),
    })),
  
  addValuationToAsset: (assetId, valuation) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId 
          ? { ...a, valuations: [...(a.valuations || []), valuation] }
          : a
      ),
    })),
  
  removeValuationFromAsset: (assetId, valuationId) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId 
          ? { ...a, valuations: (a.valuations || []).filter(v => v.id !== valuationId) }
          : a
      ),
    })),
  
  updateValuationInAsset: (assetId, valuationId, updates) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId 
          ? { 
              ...a, 
              valuations: (a.valuations || []).map(v => 
                v.id === valuationId ? { ...v, ...updates } : v
              ) 
            }
          : a
      ),
    })),
  
  // Liability actions
  addLiability: (liability) =>
    set((state) => ({
      liabilities: [...state.liabilities, liability],
    })),
    
  updateLiability: (id, updates) =>
    set((state) => ({
      liabilities: state.liabilities.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      ),
    })),
    
  removeLiability: (id) =>
    set((state) => ({
      liabilities: state.liabilities.filter((l) => l.id !== id),
    })),
  
  addPaymentToLiability: (liabilityId, payment) =>
    set((state) => ({
      liabilities: state.liabilities.map((l) => {
        if (l.id === liabilityId) {
          const updatedPayments = [...(l.payments || []), payment];
          const totalPrincipalPaid = updatedPayments.reduce((sum, p) => sum + p.principalPaid, 0);
          return { 
            ...l, 
            payments: updatedPayments,
            currentBalance: l.originalAmount - totalPrincipalPaid
          };
        }
        return l;
      }),
    })),
  
  removePaymentFromLiability: (liabilityId, paymentId) =>
    set((state) => ({
      liabilities: state.liabilities.map((l) => {
        if (l.id === liabilityId) {
          const updatedPayments = (l.payments || []).filter(p => p.id !== paymentId);
          const totalPrincipalPaid = updatedPayments.reduce((sum, p) => sum + p.principalPaid, 0);
          return { 
            ...l, 
            payments: updatedPayments,
            currentBalance: l.originalAmount - totalPrincipalPaid
          };
        }
        return l;
      }),
    })),
  
  // Income actions
  addIncome: (income) =>
    set((state) => ({
      incomes: [...state.incomes, income],
    })),
    
  updateIncome: (id, updates) =>
    set((state) => ({
      incomes: state.incomes.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      ),
    })),
    
  removeIncome: (id) =>
    set((state) => ({
      incomes: state.incomes.filter((i) => i.id !== id),
    })),
  
  // Certificate actions
  addCertificate: (certificate) =>
    set((state) => ({
      certificates: [...state.certificates, certificate],
    })),
    
  updateCertificate: (id, updates) =>
    set((state) => ({
      certificates: state.certificates.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
    
  removeCertificate: (id) =>
    set((state) => ({
      certificates: state.certificates.filter((c) => c.id !== id),
    })),
  
  // Joint asset split
  setJointAssetSplit: (entityId, percentage) =>
    set((state) => ({
      jointAssetSplitRatio: {
        ...state.jointAssetSplitRatio,
        [entityId]: percentage,
      },
    })),
  
  // Set current tax year
  setCurrentTaxYear: (year) => set({ currentTaxYear: year }),
  
  // Persistence
  saveToStorage: async () => {
    const state = get();
    if (!state.passphrase) {
      throw new Error('No passphrase set');
    }
    
    console.log('=== SAVE TO STORAGE DEBUG ===');
    console.log('Current state from Zustand store:');
    console.log('  Entities:', state.entities.length, state.entities);
    console.log('  Assets:', state.assets.length, state.assets);
    console.log('  Liabilities:', state.liabilities.length, state.liabilities);
    console.log('  Incomes:', state.incomes.length, state.incomes);
    console.log('  Certificates:', state.certificates.length, state.certificates);
    
    const appState: AppState = {
      entities: state.entities,
      assets: state.assets,
      liabilities: state.liabilities,
      incomes: state.incomes,
      certificates: state.certificates,
      currentTaxYear: state.currentTaxYear,
      jointAssetSplitRatio: state.jointAssetSplitRatio,
      isEncrypted: true,
      lastSaved: new Date().toISOString(),
    };
    
    console.log('AppState object to be saved:', JSON.stringify(appState, null, 2));
    
    await saveState(appState, state.passphrase);
    console.log('=== SAVE COMPLETE ===');
    set({ lastSaved: appState.lastSaved });
  },
  
  loadFromStorage: async (passphrase) => {
    const state = await loadState(passphrase);
    if (state) {
      set({
        ...state,
        passphrase,
      });
    }
  },
  
  resetState: () => set({ ...initialState, passphrase: null }),
}));
