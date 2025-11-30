/**
 * Main Zustand store for application state
 * Manages entities, assets, liabilities, incomes, and persistence
 */

import { create } from 'zustand';
import type { AppState, TaxEntity, Asset, Liability, Income } from '@/types';
import { saveState, loadState } from '@/utils/storage';
import { getCurrentTaxYear } from '@/lib/taxYear';

interface StoreState extends AppState {
  passphrase: string | null;
  useAiParsing: boolean;
  geminiApiKey: string;
  
  // Actions
  setPassphrase: (passphrase: string) => void;
  setUseAiParsing: (enabled: boolean) => void;
  setGeminiApiKey: (apiKey: string) => void;
  
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
  
  // Liability actions
  addLiability: (liability: Liability) => void;
  updateLiability: (id: string, updates: Partial<Liability>) => void;
  removeLiability: (id: string) => void;
  
  // Income actions
  addIncome: (income: Income) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  removeIncome: (id: string) => void;
  
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
  currentTaxYear: getCurrentTaxYear(),
  jointAssetSplitRatio: {},
  isEncrypted: false,
};

export const useStore = create<StoreState>((set, get) => ({
  ...initialState,
  passphrase: null,
  useAiParsing: localStorage.getItem('useAiParsing') === 'true',
  geminiApiKey: localStorage.getItem('geminiApiKey') || '',
  
  setPassphrase: (passphrase) => set({ passphrase }),
  
  setUseAiParsing: (enabled) => {
    set({ useAiParsing: enabled });
    localStorage.setItem('useAiParsing', enabled ? 'true' : 'false');
  },
  
  setGeminiApiKey: (apiKey) => {
    set({ geminiApiKey: apiKey });
    localStorage.setItem('geminiApiKey', apiKey);
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
    
    const appState: AppState = {
      entities: state.entities,
      assets: state.assets,
      liabilities: state.liabilities,
      incomes: state.incomes,
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
