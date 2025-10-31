import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

export default function BackToDashboard() {
  const navigate = useNavigate();

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => navigate('/dashboard')}
      className="mb-4"
    >
      <ArrowLeft size={16} className="mr-2" />
      Back to Dashboard
    </Button>
  );
}
