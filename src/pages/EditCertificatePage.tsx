/**
 * Edit Certificate Page
 */

import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateForm } from '@/components/CertificateForm';
import { useStore } from '@/stores/useStore';

export function EditCertificatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const certificates = useStore((state) => state.certificates);

  const certificate = certificates.find((c) => c.id === id);

  if (!certificate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/certificates')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Certificates
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Certificate Not Found</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <p className="text-slate-600 mb-4">The certificate you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/certificates')}>Go to Certificates</Button>
          </div>
        </main>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-slate-900">Edit Certificate</h1>
              <p className="text-sm text-slate-600">Update certificate: {certificate.certificateNo}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <CertificateForm certificateId={id} />
      </main>
    </div>
  );
}
