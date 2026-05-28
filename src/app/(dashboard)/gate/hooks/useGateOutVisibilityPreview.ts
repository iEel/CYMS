import { useCallback, useEffect, useState } from 'react';

import type { ContainerResult, GateOutBooking } from '../types';

export interface PortalVisibilityPreviewRow {
  customerId: number;
  customerName: string | null;
  entityType: string;
  entityRef: string | null;
  accessRole: string;
  validUntil: string | null;
}

interface UseGateOutVisibilityPreviewParams {
  yardId: number;
  selectedContainer: ContainerResult | null;
  selectedBooking: GateOutBooking | null;
  billingOwnerId?: number | null;
  resolvedCustomerId?: number | null;
}

export function useGateOutVisibilityPreview({
  yardId,
  selectedContainer,
  selectedBooking,
  billingOwnerId,
  resolvedCustomerId,
}: UseGateOutVisibilityPreviewParams) {
  const [visibilityPreview, setVisibilityPreview] = useState<PortalVisibilityPreviewRow[]>([]);
  const [visibilityPreviewLoading, setVisibilityPreviewLoading] = useState(false);
  const [visibilityPreviewError, setVisibilityPreviewError] = useState('');

  const clearVisibilityPreview = useCallback(() => {
    setVisibilityPreview([]);
    setVisibilityPreviewError('');
    setVisibilityPreviewLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedContainer) {
      clearVisibilityPreview();
      return;
    }

    const controller = new AbortController();
    setVisibilityPreviewLoading(true);
    setVisibilityPreviewError('');

    fetch('/api/gate/visibility-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        yard_id: yardId,
        container_number: selectedContainer.container_number,
        container_id: selectedContainer.container_id,
        container_owner_id: selectedContainer.container_owner_id || billingOwnerId || null,
        booking_id: selectedBooking?.booking_id || null,
        booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || null,
        billing_customer_id: resolvedCustomerId || null,
        trucking_company_id: selectedBooking?.trucking_company_id || null,
        driver_user_id: null,
      }),
    })
      .then(async res => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || !Array.isArray(json.preview)) {
          throw new Error('Visibility preview unavailable');
        }
        if (!controller.signal.aborted) setVisibilityPreview(json.preview);
      })
      .catch(err => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          console.error('visibility preview error', err);
          setVisibilityPreview([]);
          setVisibilityPreviewError('Visibility preview unavailable');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setVisibilityPreviewLoading(false);
      });

    return () => controller.abort();
  }, [
    billingOwnerId,
    clearVisibilityPreview,
    resolvedCustomerId,
    selectedBooking,
    selectedContainer,
    yardId,
  ]);

  return {
    visibilityPreview,
    visibilityPreviewLoading,
    visibilityPreviewError,
    clearVisibilityPreview,
  };
}
