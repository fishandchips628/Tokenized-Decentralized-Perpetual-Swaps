import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockClarity = {
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  },
  block: {
    height: 100,
  },
  contracts: {},
};

// Mock the asset-verification contract
const assetVerification = {
  admin: mockClarity.tx.sender,
  verifiedAssets: new Map(),
  
  // Constants
  ERR_NOT_AUTHORIZED: 100,
  ERR_ASSET_EXISTS: 101,
  ERR_ASSET_NOT_FOUND: 102,
  ERR_INVALID_PRICE: 103,
  
  // Functions
  isAdmin() {
    return mockClarity.tx.sender === this.admin;
  },
  
  addAsset(assetSymbol, initialPrice, oracle) {
    if (!this.isAdmin()) {
      return { type: 'err', value: this.ERR_NOT_AUTHORIZED };
    }
    
    if (this.verifiedAssets.has(assetSymbol)) {
      return { type: 'err', value: this.ERR_ASSET_EXISTS };
    }
    
    if (initialPrice <= 0) {
      return { type: 'err', value: this.ERR_INVALID_PRICE };
    }
    
    this.verifiedAssets.set(assetSymbol, {
      price: initialPrice,
      lastUpdated: mockClarity.block.height,
      oracle,
      active: true
    });
    
    return { type: 'ok', value: true };
  },
  
  updatePrice(assetSymbol, newPrice) {
    const asset = this.verifiedAssets.get(assetSymbol);
    
    if (!asset) {
      return { type: 'err', value: this.ERR_ASSET_NOT_FOUND };
    }
    
    if (mockClarity.tx.sender !== this.admin && mockClarity.tx.sender !== asset.oracle) {
      return { type: 'err', value: this.ERR_NOT_AUTHORIZED };
    }
    
    if (newPrice <= 0) {
      return { type: 'err', value: this.ERR_INVALID_PRICE };
    }
    
    asset.price = newPrice;
    asset.lastUpdated = mockClarity.block.height;
    this.verifiedAssets.set(assetSymbol, asset);
    
    return { type: 'ok', value: true };
  },
  
  getAssetPrice(assetSymbol) {
    const asset = this.verifiedAssets.get(assetSymbol);
    
    if (asset) {
      return { type: 'ok', value: asset.price };
    } else {
      return { type: 'err', value: this.ERR_ASSET_NOT_FOUND };
    }
  },
  
  isAssetActive(assetSymbol) {
    const asset = this.verifiedAssets.get(assetSymbol);
    
    if (asset) {
      return { type: 'ok', value: asset.active };
    } else {
      return { type: 'err', value: this.ERR_ASSET_NOT_FOUND };
    }
  },
  
  setAssetStatus(assetSymbol, active) {
    if (!this.isAdmin()) {
      return { type: 'err', value: this.ERR_NOT_AUTHORIZED };
    }
    
    const asset = this.verifiedAssets.get(assetSymbol);
    
    if (!asset) {
      return { type: 'err', value: this.ERR_ASSET_NOT_FOUND };
    }
    
    asset.active = active;
    this.verifiedAssets.set(assetSymbol, asset);
    
    return { type: 'ok', value: true };
  },
  
  setAdmin(newAdmin) {
    if (!this.isAdmin()) {
      return { type: 'err', value: this.ERR_NOT_AUTHORIZED };
    }
    
    this.admin = newAdmin;
    
    return { type: 'ok', value: true };
  }
};

describe('Asset Verification Contract', () => {
  beforeEach(() => {
    // Reset the contract state
    assetVerification.admin = mockClarity.tx.sender;
    assetVerification.verifiedAssets = new Map();
    mockClarity.block.height = 100;
  });
  
  describe('addAsset', () => {
    it('should add a new asset successfully', () => {
      const result = assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
      
      expect(result).toEqual({ type: 'ok', value: true });
      expect(assetVerification.verifiedAssets.has('BTC')).toBe(true);
      
      const asset = assetVerification.verifiedAssets.get('BTC');
      expect(asset.price).toBe(50000);
      expect(asset.active).toBe(true);
    });
    
    it('should fail if asset already exists', () => {
      assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
      const result = assetVerification.addAsset('BTC', 60000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_ASSET_EXISTS });
    });
    
    it('should fail if price is invalid', () => {
      const result = assetVerification.addAsset('BTC', 0, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_INVALID_PRICE });
    });
    
    it('should fail if caller is not admin', () => {
      mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      
      const result = assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_NOT_AUTHORIZED });
    });
  });
  
  describe('updatePrice', () => {
    beforeEach(() => {
      assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    });
    
    it('should update price successfully as admin', () => {
      const result = assetVerification.updatePrice('BTC', 55000);
      
      expect(result).toEqual({ type: 'ok', value: true });
      expect(assetVerification.verifiedAssets.get('BTC').price).toBe(55000);
    });
    
    it('should update price successfully as oracle', () => {
      mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      
      const result = assetVerification.updatePrice('BTC', 55000);
      
      expect(result).toEqual({ type: 'ok', value: true });
      expect(assetVerification.verifiedAssets.get('BTC').price).toBe(55000);
    });
    
    it('should fail if asset does not exist', () => {
      const result = assetVerification.updatePrice('ETH', 3000);
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_ASSET_NOT_FOUND });
    });
    
    it('should fail if price is invalid', () => {
      const result = assetVerification.updatePrice('BTC', 0);
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_INVALID_PRICE });
    });
    
    it('should fail if caller is not admin or oracle', () => {
      mockClarity.tx.sender = 'ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      
      const result = assetVerification.updatePrice('BTC', 55000);
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_NOT_AUTHORIZED });
    });
  });
  
  describe('getAssetPrice', () => {
    beforeEach(() => {
      assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    });
    
    it('should return the price for an existing asset', () => {
      const result = assetVerification.getAssetPrice('BTC');
      
      expect(result).toEqual({ type: 'ok', value: 50000 });
    });
    
    it('should fail if asset does not exist', () => {
      const result = assetVerification.getAssetPrice('ETH');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_ASSET_NOT_FOUND });
    });
  });
  
  describe('isAssetActive', () => {
    beforeEach(() => {
      assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    });
    
    it('should return active status for an existing asset', () => {
      const result = assetVerification.isAssetActive('BTC');
      
      expect(result).toEqual({ type: 'ok', value: true });
    });
    
    it('should return updated status after setAssetStatus', () => {
      assetVerification.setAssetStatus('BTC', false);
      const result = assetVerification.isAssetActive('BTC');
      
      expect(result).toEqual({ type: 'ok', value: false });
    });
    
    it('should fail if asset does not exist', () => {
      const result = assetVerification.isAssetActive('ETH');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_ASSET_NOT_FOUND });
    });
  });
  
  describe('setAssetStatus', () => {
    beforeEach(() => {
      assetVerification.addAsset('BTC', 50000, 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    });
    
    it('should update asset status successfully', () => {
      const result = assetVerification.setAssetStatus('BTC', false);
      
      expect(result).toEqual({ type: 'ok', value: true });
      expect(assetVerification.verifiedAssets.get('BTC').active).toBe(false);
    });
    
    it('should fail if asset does not exist', () => {
      const result = assetVerification.setAssetStatus('ETH', false);
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_ASSET_NOT_FOUND });
    });
    
    it('should fail if caller is not admin', () => {
      mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      
      const result = assetVerification.setAssetStatus('BTC', false);
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_NOT_AUTHORIZED });
    });
  });
  
  describe('setAdmin', () => {
    it('should update admin successfully', () => {
      const newAdmin = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      
      const result = assetVerification.setAdmin(newAdmin);
      
      expect(result).toEqual({ type: 'ok', value: true });
      expect(assetVerification.admin).toBe(newAdmin);
    });
    
    it('should fail if caller is not admin', () => {
      mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
      
      const result = assetVerification.setAdmin('ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
      
      expect(result).toEqual({ type: 'err', value: assetVerification.ERR_NOT_AUTHORIZED });
    });
  });
});
