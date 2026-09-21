'use client';

import { toast } from '@/components/ui/toast';

export function showToast(message: string, type: 'success' | 'info' = 'info') {
  toast.add({ description: message, type, timeout: 4200 });
}

export function showErrorToast(message: string, title = 'Ocurrió un error') {
  toast.add({
    title,
    description: message,
    type: 'error',
    priority: 'high',
    timeout: 6000,
  });
}
