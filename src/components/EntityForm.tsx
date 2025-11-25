/**
 * Entity Form Component (FR-01)
 * Creates/Edits Tax Entity profiles
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaxEntity } from '@/types';

interface EntityFormProps {
  entity?: TaxEntity;
  onSave: (entity: Omit<TaxEntity, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

export function EntityForm({ entity, onSave, onCancel }: EntityFormProps) {
  const [formData, setFormData] = useState({
    name: entity?.name || '',
    tin: entity?.tin || '',
    mobile: entity?.mobile || '',
    email: entity?.email || '',
    role: entity?.role || ('primary' as 'primary' | 'spouse'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entity ? 'Edit' : 'Add'} Tax Entity</CardTitle>
        <CardDescription>
          Enter taxpayer information as per IRD Guide Page 30
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange('name')}
              required
              placeholder="As per NIC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tin">Tax Identification Number (TIN) *</Label>
            <Input
              id="tin"
              value={formData.tin}
              onChange={handleChange('tin')}
              required
              placeholder="123456789V or 123456789012"
              maxLength={12}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Number *</Label>
            <Input
              id="mobile"
              type="tel"
              value={formData.mobile}
              onChange={handleChange('mobile')}
              required
              placeholder="0771234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              required
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  role: e.target.value as 'primary' | 'spouse',
                }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="primary">Primary Taxpayer</option>
              <option value="spouse">Spouse</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {entity ? 'Update' : 'Create'} Entity
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
