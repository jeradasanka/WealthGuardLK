/**
 * Add New Certificate Page
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateForm } from '@/components/CertificateForm';

export function AddCertificatePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/certificates')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Certificates
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Add New Certificate</h1>
              <p className="text-sm text-slate-600">Enter AIT/WHT certificate details</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <CertificateForm />
      </main>
    </div>
  );
}
