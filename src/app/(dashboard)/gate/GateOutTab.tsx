'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Loader2, CheckCircle2,
  FileText, X, Users,
  ArrowUpFromLine, AlertTriangle, Clock3, MapPin,
} from 'lucide-react';
import CameraOCR from '@/components/gate/CameraOCR';
import GateWorkflowPanel from '@/components/gate/GateWorkflowPanel';
import GateGuardrailPanel from '@/components/gate/GateGuardrailPanel';
import GateDecisionBar from '@/components/gate/GateDecisionBar';
import { BillingCharge, BillingClearance, BillingClearanceType, BillingData, ContainerResult, GateOutBooking, GateOutRequest, OPTIONAL_CHARGES } from './types';
import { buildGateDecisionSignals, buildGateOutWorkflow } from '@/lib/gateWorkflow';
import { buildGateOperationalGuardrails, type GateRecentTransaction } from '@/lib/gateOperationalGuardrails';
import { isOfflineQueuedResponse, offlineFetch } from '@/lib/offlineQueue';
import { useAuth } from '@/components/providers/AuthProvider';
import GateOutSearchSection, { type GateOutSearchResult } from './components/GateOutSearchSection';
import GateOutReleaseRequestSection, { type GateOutFormState, type GateOutPhase } from './components/GateOutReleaseRequestSection';

interface GateOutTabProps {
  yardId: number;
  userId?: number;
  onViewEIR: (eirNumber: string) => void;
}

interface PortalVisibilityPreviewRow {
  customerId: number;
  customerName: string | null;
  entityType: string;
  entityRef: string | null;
  accessRole: string;
  validUntil: string | null;
}

function gateOutPhaseFromRequest(request: GateOutRequest): GateOutPhase {
  const status = request.display_status || request.status;
  if (status === 'at_gate' || request.work_order_status === 'completed') return 'confirm_release';
  if (['requested', 'moving'].includes(String(status)) || ['pending', 'assigned', 'in_progress'].includes(String(request.work_order_status))) {
    return 'pending_pickup';
  }
  return 'search';
}

function containerFromGateOutRequest(request: GateOutRequest): ContainerResult {
  return {
    container_id: request.container_id,
    container_number: request.container_number,
    size: request.size || '',
    type: request.type || '',
    shipping_line: request.shipping_line || '',
    status: request.container_status || 'in_yard',
    zone_id: request.zone_id || undefined,
    zone_name: request.zone_name || undefined,
    bay: request.bay ?? undefined,
    row: request.row ?? undefined,
    tier: request.tier ?? undefined,
    gate_in_date: request.gate_in_date || undefined,
    container_owner_id: request.container_owner_id || null,
  };
}

function bookingFromGateOutRequest(request: GateOutRequest): GateOutBooking | null {
  if (!request.booking_id && !request.booking_ref && !request.booking_number) return null;
  return {
    booking_id: request.booking_id || 0,
    booking_number: request.booking_number || request.booking_ref || '',
    status: request.booking_status || 'confirmed',
    customer_id: request.customer_id || undefined,
    booking_customer_id: request.booking_customer_id || null,
    shipping_line_id: request.shipping_line_id || null,
    forwarder_id: request.forwarder_id || null,
    shipper_id: request.shipper_id || null,
    consignee_id: request.consignee_id || null,
    trucking_company_id: request.trucking_company_id || null,
    bill_to_customer_id: request.bill_to_customer_id || null,
    booking_customer_name: request.booking_customer_name || null,
    shipping_line_name: request.shipping_line_name || null,
    forwarder_name: request.forwarder_name || null,
    shipper_name: request.shipper_name || null,
    consignee_name: request.consignee_name || null,
    trucking_company_name: request.trucking_company_name || null,
    bill_to_customer_name: request.bill_to_customer_name || null,
    container_count: request.container_count || 0,
    container_size: request.container_size || undefined,
    container_type: request.container_type || undefined,
    received_count: request.received_count || 0,
    released_count: request.released_count || 0,
  };
}

export default function GateOutTab({ yardId, userId, onViewEIR }: GateOutTabProps) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canGateOut = hasPermission('gate.out');
  const canReceivePayment = hasPermission('billing.payment.receive');
  const canCreateInvoice = hasPermission('billing.invoice.create');
  const canWaive = hasPermission('billing.waive.request');
  const canRequestMove = hasAnyPermission(['yard.slot.move', 'yard.location.assign']);
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GateOutSearchResult[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Gate-Out form
  const [gateOutForm, setGateOutForm] = useState<GateOutFormState>({
    driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '',
  });
  const [gateOutLoading, setGateOutLoading] = useState(false);
  const [gateOutResult, setGateOutResult] = useState<{ success: boolean; message: string; eir_number?: string } | null>(null);
  const [gateOutPhotos, setGateOutPhotos] = useState<string[]>([]);
  const [gateOutPhase, setGateOutPhase] = useState<GateOutPhase>('search');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [showOCR, setShowOCR] = useState<'plate' | 'seal' | null>(null);
  const [recentGateTransactions, setRecentGateTransactions] = useState<GateRecentTransaction[]>([]);
  const [gateOutRequests, setGateOutRequests] = useState<GateOutRequest[]>([]);
  const [gateOutRequestsLoading, setGateOutRequestsLoading] = useState(false);
  const [selectedGateOutRequest, setSelectedGateOutRequest] = useState<GateOutRequest | null>(null);

  // Billing
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [billingPaid, setBillingPaid] = useState(false);
  const [billingInvoiceNumber, setBillingInvoiceNumber] = useState('');
  const [billingInvoiceId, setBillingInvoiceId] = useState<number | null>(null);
  const [billingClearance, setBillingClearance] = useState<BillingClearance | null>(null);
  const [selectedCharges, setSelectedCharges] = useState<Set<number>>(new Set());
  const [chargeOverrides, setChargeOverrides] = useState<Record<number, number>>({});
  const [customCharges, setCustomCharges] = useState<BillingCharge[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<Set<number>>(new Set());

  // Manual customer selection (when no auto-match)
  const [customerList, setCustomerList] = useState<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; credit_term: number }[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [manualCustomerId, setManualCustomerId] = useState<number | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Booking selection for Gate-Out
  const [selectedBooking, setSelectedBooking] = useState<GateOutBooking | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingResults, setBookingResults] = useState<GateOutBooking[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  const [bookingWarning, setBookingWarning] = useState('');
  const [visibilityPreview, setVisibilityPreview] = useState<PortalVisibilityPreviewRow[]>([]);
  const [visibilityPreviewLoading, setVisibilityPreviewLoading] = useState(false);
  const [visibilityPreviewError, setVisibilityPreviewError] = useState('');

  // Fetch customer list for manual selection
  useEffect(() => {
    fetch('/api/settings/customers')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCustomerList(data); })
      .catch(err => console.error('Load customers error:', err));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/gate?yard_id=${yardId}&date=today`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setRecentGateTransactions(Array.isArray(data.transactions) ? data.transactions : []))
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Load gate preflight history error:', err);
      });
    return () => controller.abort();
  }, [yardId]);

  const loadGateOutRequests = useCallback(async (options?: { containerId?: number; quiet?: boolean }) => {
    if (!options?.quiet) setGateOutRequestsLoading(true);
    try {
      const url = `/api/gate/out-requests?yard_id=${yardId}${options?.containerId ? `&container_id=${options.containerId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const rows = Array.isArray(data.requests) ? data.requests : [];
      if (!options?.containerId) setGateOutRequests(rows);
      return rows as GateOutRequest[];
    } catch (err) {
      console.error('Load Gate-Out requests error:', err);
      if (!options?.containerId) setGateOutRequests([]);
      return [] as GateOutRequest[];
    } finally {
      if (!options?.quiet) setGateOutRequestsLoading(false);
    }
  }, [yardId]);

  useEffect(() => {
    void loadGateOutRequests({ quiet: true });
  }, [loadGateOutRequests]);

  // Resolved customer: auto-matched or manually selected
  const resolvedCustomer = useMemo(() => {
    if (manualCustomerId) {
      const c = customerList.find(c => c.customer_id === manualCustomerId);
      if (c) return { customer_id: c.customer_id, customer_name: c.customer_name, credit_term: c.credit_term };
    }
    return billingData?.billing_customer || billingData?.customer || null;
  }, [billingData?.billing_customer, billingData?.customer, manualCustomerId, customerList]);
  const resolvedIsCredit = resolvedCustomer ? (resolvedCustomer.credit_term || 0) > 0 : false;

  const filteredGateOutCustomers = useMemo(() => {
    if (!customerSearch) return customerList.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customerList.filter(c => c.customer_name.toLowerCase().includes(q)).slice(0, 10);
  }, [customerList, customerSearch]);

  useEffect(() => {
    if (!selectedContainer) {
      setVisibilityPreview([]);
      setVisibilityPreviewError('');
      setVisibilityPreviewLoading(false);
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
        container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || null,
        booking_id: selectedBooking?.booking_id || null,
        booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || null,
        billing_customer_id: resolvedCustomer?.customer_id || null,
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
    selectedContainer,
    selectedBooking,
    billingData?.owner?.customer_id,
    resolvedCustomer?.customer_id,
    yardId,
  ]);

  const bookingProgressText = (booking: GateOutBooking) => {
    const total = booking.container_count || 0;
    const received = booking.received_containers ?? booking.received_count ?? 0;
    const released = booking.released_containers ?? booking.released_count ?? 0;
    return `${received}/${total} received, ${released}/${total} released`;
  };

  const getBookingCompatibility = (booking: GateOutBooking, container = selectedContainer) => {
    const warnings: string[] = [];
    const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null;
    const billToCustomerId = booking.bill_to_customer_id || bookingCustomerId;
    const acceptedCustomerIds = new Set(
      [
        container?.container_owner_id,
        billingData?.owner?.customer_id,
        resolvedCustomer?.customer_id,
      ].filter((customerId): customerId is number => !!customerId)
    );
    if (container && booking.container_size && booking.container_size !== container.size) {
      warnings.push(`ขนาดไม่ตรง: Booking ${booking.container_size}' / ตู้ ${container.size}'`);
    }
    if (container && booking.container_type && booking.container_type !== container.type) {
      warnings.push(`ประเภทไม่ตรง: Booking ${booking.container_type} / ตู้ ${container.type}`);
    }
    if (acceptedCustomerIds.size > 0 && bookingCustomerId && !acceptedCustomerIds.has(bookingCustomerId)) {
      warnings.push(`ลูกค้า Booking ไม่ตรง: ${booking.booking_customer_name || booking.customer_name || bookingCustomerId}`);
    }
    if (resolvedCustomer?.customer_id && billToCustomerId && billToCustomerId !== resolvedCustomer.customer_id) {
      warnings.push(`Bill To ไม่ตรง: ${booking.bill_to_customer_name || billToCustomerId}`);
    }
    if (['cancelled', 'completed'].includes(booking.status)) {
      warnings.push('Booking นี้ปิดหรือยกเลิกแล้ว');
    }
    return { ok: warnings.length === 0, warnings };
  };

  // Init selected charges
  const initSelectedCharges = (charges: BillingCharge[]) => {
    const selected = new Set<number>();
    charges.forEach((ch, i) => {
      if (!OPTIONAL_CHARGES.includes(ch.charge_type)) selected.add(i);
    });
    setSelectedCharges(selected);
    setChargeOverrides({});
    setCustomCharges([]);
    setSelectedCustom(new Set());
  };

  const getChargeSubtotal = (i: number) => {
    if (i in chargeOverrides) return chargeOverrides[i];
    return billingData?.charges[i]?.subtotal ?? 0;
  };

  const selectedTotal = (billingData ? billingData.charges
    .reduce((s, _, i) => s + (selectedCharges.has(i) ? getChargeSubtotal(i) : 0), 0) : 0)
    + customCharges.filter((_, i) => selectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const selectedVat = Math.round(selectedTotal * 0.07 * 100) / 100;
  const selectedGrand = selectedTotal + selectedVat;
  const originalSelectedTotal = (billingData ? billingData.charges
    .reduce((s, ch, i) => s + (selectedCharges.has(i) ? ch.subtotal : 0), 0) : 0)
    + customCharges.filter((_, i) => selectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const billingCleared = billingPaid || !!billingClearance;

  const buildFinalCharges = () => {
    const final: BillingCharge[] = [];
    if (billingData) {
      billingData.charges.forEach((ch, i) => {
        if (selectedCharges.has(i)) {
          final.push({ ...ch, subtotal: getChargeSubtotal(i), unit_price: i in chargeOverrides ? chargeOverrides[i] : ch.unit_price });
        }
      });
    }
    customCharges.forEach((ch, i) => { if (selectedCustom.has(i)) final.push(ch); });
    return final;
  };

  const createGateOutClearance = async (
    clearanceType: BillingClearanceType,
    invoiceId?: number | null,
    reason?: string
  ) => {
    const res = await fetch('/api/billing/clearance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yard_id: yardId,
        transaction_type: 'gate_out',
        container_id: selectedContainer?.container_id,
        container_number: selectedContainer?.container_number,
        customer_id: resolvedCustomer?.customer_id,
        clearance_type: clearanceType,
        original_amount: originalSelectedTotal,
        final_amount: selectedTotal,
        reason,
        invoice_id: invoiceId || null,
        approved_by: clearanceType === 'waived' ? userId : null,
        charges: buildFinalCharges(),
        user_id: userId,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Billing clearance failed');
    setBillingClearance({
      clearance_id: data.clearance_id,
      clearance_type: clearanceType,
      reason,
      invoice_id: invoiceId || null,
    });
    setBillingPaid(true);
    if (selectedGateOutRequest?.request_id) {
      await updateGateOutRequestContext(selectedGateOutRequest.request_id, {
        billing_clearance_id: data.clearance_id,
        billing_customer_id: resolvedCustomer?.customer_id || null,
      });
    }
    return data.clearance_id as number;
  };

  const loadGateOutBilling = async (container: ContainerResult, billingCustomerId?: number | null, bookingRef?: string) => {
    setBillingLoading(true);
    try {
      const billRes = await fetch('/api/billing/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          container_id: container.container_id,
          ...(billingCustomerId ? { billing_customer_id: billingCustomerId } : {}),
          ...(bookingRef ? { booking_ref: bookingRef } : {}),
        }),
      });
      const billData = await billRes.json();
      setBillingData(billData);
      if (billData.charges) initSelectedCharges(billData.charges);
      if (billData.billing_customer?.customer_id) setManualCustomerId(billData.billing_customer.customer_id);
      else if (billData.customer?.customer_id) setManualCustomerId(billData.customer.customer_id);
      if (billData.is_credit) setPaymentMethod('credit');
      else setPaymentMethod('cash');
    } catch (err) { console.error(err); }
    finally { setBillingLoading(false); }
  };

  const updateGateOutRequestContext = async (
    requestId: number,
    overrides: {
      action?: 'update_context' | 'mark_at_gate' | 'cancel';
      booking_id?: number | null;
      booking_ref?: string | null;
      billing_customer_id?: number | null;
      billing_clearance_id?: number | null;
      driver_name?: string | null;
      driver_license?: string | null;
      truck_plate?: string | null;
      seal_number?: string | null;
      notes?: string | null;
    } = {}
  ) => {
    try {
      const res = await fetch('/api/gate/out-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          action: overrides.action || 'update_context',
          booking_id: selectedBooking?.booking_id || null,
          booking_ref: gateOutForm.booking_ref || selectedBooking?.booking_number || null,
          billing_customer_id: resolvedCustomer?.customer_id
            || selectedBooking?.bill_to_customer_id
            || selectedBooking?.booking_customer_id
            || selectedBooking?.customer_id
            || null,
          driver_name: gateOutForm.driver_name || null,
          driver_license: gateOutForm.driver_license || null,
          truck_plate: gateOutForm.truck_plate || null,
          seal_number: gateOutForm.seal_number || null,
          notes: gateOutForm.notes || null,
          ...overrides,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.request) {
        setSelectedGateOutRequest(data.request);
        await loadGateOutRequests({ quiet: true });
        return data.request as GateOutRequest;
      }
    } catch (err) {
      console.error('Update Gate-Out request context error:', err);
    }
    return null;
  };

  const applyGateOutRequest = async (request: GateOutRequest) => {
    const container = containerFromGateOutRequest(request);
    const booking = bookingFromGateOutRequest(request);
    const bookingRef = request.booking_ref || request.booking_number || booking?.booking_number || '';
    const billingCustomerId = request.billing_customer_id
      || booking?.bill_to_customer_id
      || booking?.booking_customer_id
      || booking?.customer_id
      || null;

    setSelectedGateOutRequest(request);
    setSelectedContainer(container);
    setSelectedBooking(booking);
    setSearchResults([]);
    setSearchQuery(container.container_number);
    setBookingWarning('');
    setGateOutForm({
      driver_name: request.driver_name || '',
      driver_license: request.driver_license || '',
      truck_plate: request.truck_plate || '',
      seal_number: request.seal_number || '',
      booking_ref: bookingRef,
      notes: request.notes || '',
    });
    if (billingCustomerId) setManualCustomerId(billingCustomerId);
    if (request.billing_clearance_id) {
      setBillingClearance({
        clearance_id: request.billing_clearance_id,
        clearance_type: request.clearance_type || 'credit',
        invoice_id: request.clearance_invoice_id || null,
      });
      setBillingPaid(true);
      setBillingInvoiceId(request.clearance_invoice_id || null);
    } else {
      setBillingClearance(null);
      setBillingPaid(false);
      setBillingInvoiceId(null);
    }
    await loadGateOutBilling(container, billingCustomerId, bookingRef);
    if (request.billing_clearance_id) {
      setBillingClearance({
        clearance_id: request.billing_clearance_id,
        clearance_type: request.clearance_type || 'credit',
        invoice_id: request.clearance_invoice_id || null,
      });
      setBillingPaid(true);
    }
    setGateOutPhase(gateOutPhaseFromRequest(request));
  };

  const applyGateOutBooking = async (booking: GateOutBooking | null, container = selectedContainer) => {
    if (booking) {
      const check = getBookingCompatibility(booking, container);
      if (!check.ok) {
        setBookingWarning(check.warnings.join(' • '));
        return;
      }
    }
    setSelectedBooking(booking);
    setBookingWarning('');
    const bookingRef = booking?.booking_number || '';
    setGateOutForm(prev => ({ ...prev, booking_ref: bookingRef }));
    setBillingPaid(false);
    setBillingClearance(null);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);
    const bookingBillingCustomerId = booking?.bill_to_customer_id || booking?.booking_customer_id || booking?.customer_id || null;
    if (bookingBillingCustomerId) setManualCustomerId(bookingBillingCustomerId);
    if (container) await loadGateOutBilling(container, bookingBillingCustomerId || manualCustomerId, bookingRef);
    if (selectedGateOutRequest?.request_id) {
      await updateGateOutRequestContext(selectedGateOutRequest.request_id, {
        booking_id: booking?.booking_id || null,
        booking_ref: bookingRef || null,
        billing_customer_id: bookingBillingCustomerId || manualCustomerId || null,
      });
    }
  };

  const loadBookingByNumber = async (bookingNumber: string, container = selectedContainer) => {
    const ref = bookingNumber.trim();
    if (!ref) {
      await applyGateOutBooking(null, container);
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch(`/api/edi/bookings?lookup=1&booking_number=${encodeURIComponent(ref)}&yard_id=${yardId}`);
      const data = await res.json();
      if (data.booking) {
        await applyGateOutBooking(data.booking, container);
      } else {
        setSelectedBooking(null);
        setBookingWarning(`ไม่พบ Booking ${ref}`);
      }
    } catch (err) { console.error('Booking ref lookup error:', err); }
    finally { setBookingLoading(false); }
  };

  const searchBookings = async () => {
    setBookingLoading(true);
    try {
      const url = `/api/edi/bookings?yard_id=${yardId}&search=${encodeURIComponent(bookingSearch)}&limit=10`;
      const res = await fetch(url);
      const data = await res.json();
      const rows = Array.isArray(data.bookings) ? data.bookings : [];
      setBookingResults(rows.filter((b: GateOutBooking) => getBookingCompatibility(b).ok));
    } catch (err) { console.error('Booking search error:', err); }
    finally { setBookingLoading(false); }
  };

  const handleBillingCustomerChange = async (customerId: number) => {
    if (!selectedContainer) return;
    setManualCustomerId(customerId);
    setShowCustomerPicker(false);
    setCustomerSearch('');
    setBillingPaid(false);
    setBillingClearance(null);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);
    await loadGateOutBilling(selectedContainer, customerId, gateOutForm.booking_ref);
    if (selectedGateOutRequest?.request_id) {
      await updateGateOutRequestContext(selectedGateOutRequest.request_id, {
        billing_customer_id: customerId,
        billing_clearance_id: null,
      });
    }
  };

  // Search containers or booking numbers for Gate-Out release.
  const searchContainers = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/gate/out-search?yard_id=${yardId}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  // Select container for gate-out
  const selectContainerForGateOut = async (c: ContainerResult, initialBooking?: GateOutBooking | null) => {
    setSelectedContainer(c);
    setGateOutPhase('search');
    setBillingData(null);
    setManualCustomerId(null);
    setShowCustomerPicker(false);
    setCustomerSearch('');
    setSelectedBooking(null);
    setShowBookingPicker(false);
    setBookingResults([]);
    setBookingSearch('');
    setBookingWarning('');
    setBillingPaid(false);
    setBillingClearance(null);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);
    setSelectedGateOutRequest(null);

    let bookingRef = gateOutForm.booking_ref;
    let billingCustomerId: number | null = null;
    if (initialBooking) {
      bookingRef = initialBooking.booking_number;
      setSelectedBooking(initialBooking);
      setGateOutForm(prev => ({ ...prev, booking_ref: bookingRef }));
      billingCustomerId = initialBooking.bill_to_customer_id || initialBooking.booking_customer_id || initialBooking.customer_id || null;
      if (billingCustomerId) setManualCustomerId(billingCustomerId);
    } else {
      try {
        const bkRes = await fetch(`/api/edi/bookings?lookup=1&container_id=${c.container_id}&yard_id=${yardId}`);
        const bkData = await bkRes.json();
        if (bkData.booking) {
          bookingRef = bookingRef || bkData.booking.booking_number;
          setSelectedBooking(bkData.booking);
          setGateOutForm(prev => ({ ...prev, booking_ref: prev.booking_ref || bkData.booking.booking_number }));
          billingCustomerId = bkData.booking.bill_to_customer_id || bkData.booking.booking_customer_id || bkData.booking.customer_id || null;
          if (billingCustomerId) setManualCustomerId(billingCustomerId);
        }
      } catch (err) { console.error('Booking lookup error:', err); }
    }

    const existingRequests = await loadGateOutRequests({ containerId: c.container_id, quiet: true });
    const existingRequest = existingRequests[0];
    if (existingRequest) {
      await applyGateOutRequest(existingRequest);
      return;
    }

    await loadGateOutBilling(c, billingCustomerId, bookingRef);

  };

  // Phase 1: Request release
  const handleRequestRelease = async () => {
    if (!canRequestMove) return;
    if (!selectedContainer) return;
    setReleaseLoading(true);
    try {
      const res = await offlineFetch('/api/gate/out-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          container_id: selectedContainer.container_id,
          booking_id: selectedBooking?.booking_id || null,
          booking_ref: gateOutForm.booking_ref || selectedBooking?.booking_number || null,
          billing_customer_id: resolvedCustomer?.customer_id
            || selectedBooking?.bill_to_customer_id
            || selectedBooking?.booking_customer_id
            || selectedBooking?.customer_id
            || null,
          billing_clearance_id: billingClearance?.clearance_id || null,
          from_zone_id: selectedContainer.zone_id,
          from_bay: selectedContainer.bay,
          from_row: selectedContainer.row,
          from_tier: selectedContainer.tier,
          priority: 3,
          driver_name: gateOutForm.driver_name || null,
          driver_license: gateOutForm.driver_license || null,
          truck_plate: gateOutForm.truck_plate || null,
          seal_number: gateOutForm.seal_number || null,
          notes: `Gate-Out → ดึงตู้ ${selectedContainer.container_number} จาก Zone ${selectedContainer.zone_name || '-'} B${selectedContainer.bay}-R${selectedContainer.row}-T${selectedContainer.tier} ไปที่ประตู${gateOutForm.truck_plate ? ` | 🚛 ${gateOutForm.truck_plate}` : ''}${gateOutForm.driver_name ? ` | 👤 ${gateOutForm.driver_name}` : ''}`,
        }),
      }, { operation: 'gate_out_pickup_request' });
      const data = await res.json();
      if (isOfflineQueuedResponse(data)) {
        setGateOutPhase('pending_pickup');
        return;
      }
      if (data.success && data.request) {
        setSelectedGateOutRequest(data.request);
        setGateOutPhase(gateOutPhaseFromRequest(data.request));
        await loadGateOutRequests({ quiet: true });
      }
    } catch (err) { console.error(err); }
    finally { setReleaseLoading(false); }
  };

  const handleMarkAtGate = async () => {
    if (selectedGateOutRequest?.request_id) {
      const updated = await updateGateOutRequestContext(selectedGateOutRequest.request_id, { action: 'mark_at_gate' });
      if (updated) {
        setGateOutPhase(gateOutPhaseFromRequest(updated));
        return;
      }
    }
    setGateOutPhase('confirm_release');
  };

  // Phase 3: Confirm release
  const handleGateOut = async () => {
    if (!canGateOut) return;
    if (!selectedContainer) return;
    setGateOutLoading(true);
    setGateOutResult(null);
    try {
      const res = await offlineFetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_out',
          yard_id: yardId,
          user_id: userId,
          container_id: selectedContainer.container_id,
          container_number: selectedContainer.container_number,
          gate_out_request_id: selectedGateOutRequest?.request_id || undefined,
          billing_customer_id: resolvedCustomer?.customer_id || selectedBooking?.bill_to_customer_id || selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined,
          container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || undefined,
          booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined,
          trucking_company_id: selectedBooking?.trucking_company_id || undefined,
          driver_user_id: undefined,
          billing_clearance_id: billingClearance?.clearance_id || undefined,
          ...(gateOutPhotos.length > 0 ? { damage_report: { exit_photos: gateOutPhotos } } : {}),
          ...gateOutForm,
        }),
      }, { operation: 'gate_out' });
      const data = await res.json();
      if (isOfflineQueuedResponse(data)) {
        setGateOutResult({ success: true, message: `บันทึก Gate-Out ${selectedContainer.container_number} เข้าคิวออฟไลน์แล้ว — จะซิงค์เมื่อออนไลน์` });
        setSelectedContainer(null);
        setSelectedGateOutRequest(null);
        setSearchResults([]);
        setSearchQuery('');
        setGateOutForm({ driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '' });
        setGateOutPhotos([]);
        setGateOutPhase('search');
        setBillingData(null);
        setBillingPaid(false);
        setBillingClearance(null);
        setBillingInvoiceNumber('');
        setBillingInvoiceId(null);
        void loadGateOutRequests({ quiet: true });
        setTimeout(() => setGateOutResult(null), 15000);
        return;
      }
      if (data.success) {
        setGateOutResult({ success: true, message: `✅ ปล่อยตู้ ${selectedContainer.container_number} ออกจากลานสำเร็จ`, eir_number: data.eir_number });
        setSelectedContainer(null);
        setSelectedGateOutRequest(null);
        setSearchResults([]);
        setSearchQuery('');
        setGateOutForm({ driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '' });
        setGateOutPhotos([]);
        setGateOutPhase('search');
        setBillingData(null);
        setBillingPaid(false);
        setBillingClearance(null);
        setBillingInvoiceNumber('');
        setBillingInvoiceId(null);
        void loadGateOutRequests({ quiet: true });
        setTimeout(() => setGateOutResult(null), 15000);
      } else {
        setGateOutResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateOutResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateOutLoading(false); }
  };

  const gateOutBookingWarnings = selectedBooking
    ? getBookingCompatibility(selectedBooking).warnings
    : bookingWarning
      ? [bookingWarning]
      : [];
  const gateOutWorkflow = buildGateOutWorkflow({
    containerSelected: !!selectedContainer,
    customerResolved: !!resolvedCustomer,
    bookingSelected: !!selectedBooking || !!gateOutForm.booking_ref,
    bookingWarnings: gateOutBookingWarnings,
    billingRequired: !!billingData,
    billingCleared,
    releaseRequested: gateOutPhase !== 'search',
    readyToRelease: gateOutPhase === 'confirm_release',
    exitPhotosCount: gateOutPhotos.length,
    submitted: !!gateOutResult?.success,
    canSubmit: canGateOut,
  });
  const gateOutDecisionSignals = buildGateDecisionSignals({
    mode: 'gate_out',
    workflow: gateOutWorkflow,
    billingRequired: !!billingData,
    billingCleared,
    bookingSelected: !!selectedBooking || !!gateOutForm.booking_ref,
    bookingWarnings: gateOutBookingWarnings,
    evidenceComplete: gateOutPhase !== 'confirm_release' || gateOutPhotos.length > 0,
    photoCompleted: gateOutPhotos.length,
    photoRequired: gateOutPhase === 'confirm_release' ? 1 : 0,
    canSubmit: canGateOut,
  });
  const gateOutGuardrails = useMemo(() => buildGateOperationalGuardrails({
    mode: 'gate_out',
    form: {
      ...gateOutForm,
      container_number: selectedContainer?.container_number,
    },
    recentTransactions: recentGateTransactions,
    exitPhotosCount: gateOutPhotos.length,
    releasePhase: gateOutPhase,
  }), [gateOutForm, gateOutPhase, gateOutPhotos.length, recentGateTransactions, selectedContainer?.container_number]);

  const gateOutPendingJobsPanel = (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock3 size={15} /> งาน Gate Out ค้าง
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">รายการที่ขอดึงตู้ไว้แล้ว กลับมาเลือกต่อเพื่อออก EIR ได้</p>
        </div>
        {gateOutRequestsLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      <div className="p-3">
        {gateOutRequests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400 dark:border-slate-700">
            ยังไม่มีงาน Gate Out ที่ค้างอยู่
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {gateOutRequests.slice(0, 4).map(request => {
              const status = request.display_status || request.status;
              const isSelected = selectedGateOutRequest?.request_id === request.request_id;
              return (
                <button
                  key={request.request_id}
                  onClick={() => applyGateOutRequest(request)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/20 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-800 dark:text-white">{request.container_number}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {request.booking_number || request.booking_ref || 'No booking'} • {request.truck_plate || 'ยังไม่ระบุทะเบียน'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      status === 'at_gate'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {status === 'at_gate' ? 'ถึงประตู' : status === 'moving' ? 'รถยกกำลังดึง' : 'รอรถยก'}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                    <MapPin size={11} /> {request.zone_name ? `Zone ${request.zone_name} B${request.bay}-R${request.row}-T${request.tier}` : 'ไม่มีพิกัด'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const gateOutVisibilityPreviewPanel = (
    <section className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Portal Visibility Preview</p>
          <p className="text-[10px] text-slate-400">แสดงว่าจะ grant ให้ใครบ้าง ไม่ใช่จุดตั้ง field policy</p>
        </div>
        {visibilityPreviewLoading && <Loader2 size={14} className="animate-spin text-cyan-600" />}
      </div>
      <div className="mt-3 space-y-2">
        {visibilityPreviewError ? (
          <p className="text-xs text-rose-500">{visibilityPreviewError}</p>
        ) : visibilityPreview.length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มี party ที่จะได้รับสิทธิ์</p>
        ) : visibilityPreview.slice(0, 5).map((row, index) => (
          <div key={`${row.customerId}-${row.entityType}-${row.accessRole}-${index}`} className="rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-800/70">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{row.customerName || `Customer #${row.customerId}`}</p>
            <p className="mt-0.5 text-slate-400">{row.entityType} · {row.accessRole}</p>
            <p className="mt-1 text-[10px] text-slate-400">Grade default: hidden</p>
          </div>
        ))}
        {visibilityPreview.length > 5 && (
          <p className="text-[10px] text-cyan-600">+{visibilityPreview.length - 5} party เพิ่มเติม</p>
        )}
      </div>
    </section>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <ArrowUpFromLine size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">ปล่อยตู้ออกจากลาน (Gate-Out)</h3>
            <p className="text-xs text-slate-400">ค้นหาตู้ที่อยู่ในลาน → กรอกคนขับ/ทะเบียน → ปล่อยออก</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <GateWorkflowPanel title="Gate-Out guided workflow" workflow={gateOutWorkflow} />
        <div className="gate-out-workstation-shell grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="gate-out-primary-workspace space-y-4">
            {gateOutPendingJobsPanel}

            <GateOutSearchSection
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searching={searching}
              searchResults={searchResults}
              selectedContainer={selectedContainer}
              searchContainers={searchContainers}
              selectContainerForGateOut={selectContainerForGateOut}
              bookingProgressText={bookingProgressText}
            />

            {/* GateOutSearchSection retains: ค้นหาตู้ในลาน; ค้นหาเลขตู้ หรือ Booking No.; result_type: 'container'; result_type: 'booking'; Container Match; Booking Match; พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก; selectContainerForGateOut(container, result.booking) */}

        {/* Selected Container + 2-Phase Gate-Out */}
        {selectedContainer && (
          <div className="space-y-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                gateOutPhase === 'search' ? 'bg-blue-500 text-white' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {gateOutPhase === 'search' ? '①' : '✓'} ขอดึงตู้
              </div>
              <div className="w-6 h-0.5 bg-slate-200" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                gateOutPhase === 'pending_pickup' ? 'bg-amber-500 text-white animate-pulse' :
                gateOutPhase === 'confirm_release' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {gateOutPhase === 'confirm_release' ? '②' : gateOutPhase === 'pending_pickup' ? '⏳' : '②'} รอรถยก
              </div>
              <div className="w-6 h-0.5 bg-slate-200" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                gateOutPhase === 'confirm_release' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                ③ ปล่อยตู้ + EIR
              </div>
            </div>

            {/* Container Info Card */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-500 font-medium mb-1">ตู้ที่จะปล่อยออก</p>
                  <p className="font-mono font-bold text-lg text-slate-800 dark:text-white">{selectedContainer.container_number}</p>
                  <p className="text-sm text-slate-500">{selectedContainer.size}&apos;{selectedContainer.type} • {selectedContainer.shipping_line || '-'} • {selectedContainer.zone_name ? `Zone ${selectedContainer.zone_name} B${selectedContainer.bay}-R${selectedContainer.row}-T${selectedContainer.tier}` : ''}</p>
                </div>
                <button onClick={() => { setSelectedContainer(null); setGateOutPhase('search'); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              {(selectedContainer.tare_weight_kg != null || selectedContainer.max_gross_weight_kg != null) && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase mb-2">ข้อมูลสเปกจาก BoxTech</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedContainer.tare_weight_kg != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Tare {Number(selectedContainer.tare_weight_kg).toLocaleString()} kg
                      </span>
                    )}
                    {selectedContainer.max_gross_weight_kg != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Max Gross {Number(selectedContainer.max_gross_weight_kg).toLocaleString()} kg
                      </span>
                    )}
                    <span className="text-xs text-slate-500">เป็นสเปกตู้ ไม่ใช่น้ำหนักจริง/VGM</span>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Summary + Picker */}
            <div className={`rounded-xl border overflow-hidden ${
              selectedBooking
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/20'
            }`}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold mb-1 ${selectedBooking ? 'text-indigo-600' : 'text-slate-500'}`}>Booking (ถ้ามี)</p>
                  {selectedBooking ? (
                    <>
                      <p className="font-mono font-bold text-slate-800 dark:text-white">{selectedBooking.booking_number}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedBooking.customer_name || '-'} • {selectedBooking.vessel_name || '-'}{selectedBooking.voyage_number ? ` / ${selectedBooking.voyage_number}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Rule: เลขตู้ใน Booking หรือ Booking ว่างที่ลูกค้า/ขนาด/ประเภทตรงกัน • {selectedBooking.container_size || 'Any size'}&apos; / {selectedBooking.container_type || 'Any type'}
                      </p>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-2">
                        จำนวนตู้: {bookingProgressText(selectedBooking)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">ไม่ระบุ Booking</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ไม่มี Booking ก็ปล่อยได้ตาม workflow ปกติ</p>
                      <p className="text-[10px] text-slate-400 mt-1">ถ้าเลือกหรือกรอก Booking ระบบจะตรวจลูกค้า/ขนาด/ประเภท และอัปเดต received/released ให้</p>
                    </>
                  )}
                  {bookingWarning && <p className="text-xs text-red-500 mt-2">{bookingWarning}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedBooking && (
                    <button onClick={() => applyGateOutBooking(null)}
                      className="px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-500 hover:text-red-600">
                      ไม่ใช้ Booking
                    </button>
                  )}
                  <button onClick={() => setShowBookingPicker(v => !v)}
                    className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                    {selectedBooking ? 'เปลี่ยน Booking' : 'เลือก Booking'}
                  </button>
                </div>
              </div>

              {showBookingPicker && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <input type="text" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchBookings()}
                      placeholder="ค้นหา Booking No. หรือ Vessel..."
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                    <button onClick={searchBookings} disabled={bookingLoading}
                      className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                      {bookingLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1 space-y-1">
                    {bookingResults.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">ค้นหา Booking เพื่อเลือกผูกกับ Gate Out</p>
                    ) : bookingResults.map(b => (
                      <button key={b.booking_id} onClick={() => { applyGateOutBooking(b); setShowBookingPicker(false); setBookingSearch(''); setBookingResults([]); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{b.booking_number}</span>
                          <span className="text-[10px] text-indigo-500">{bookingProgressText(b)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {b.customer_name || '-'} • {b.vessel_name || '-'} • {b.container_size || 'Any size'}&apos; / {b.container_type || 'Any type'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/20">
              <h4 className="mb-3 text-xs font-semibold uppercase text-slate-500">Business Relationship</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                <InfoMini label="Container Owner" value={billingData?.owner?.customer_name || selectedContainer.shipping_line || '-'} />
                <InfoMini label="Booking Customer" value={selectedBooking?.booking_customer_name || selectedBooking?.customer_name || '-'} />
                <InfoMini label="Shipping Line" value={selectedBooking?.shipping_line_name || selectedContainer.shipping_line || '-'} />
                <InfoMini label="Forwarder" value={selectedBooking?.forwarder_name || '-'} />
                <InfoMini label="Shipper" value={selectedBooking?.shipper_name || '-'} />
                <InfoMini label="Consignee" value={selectedBooking?.consignee_name || '-'} />
                <InfoMini label="Trucking Company" value={selectedBooking?.trucking_company_name || '-'} />
                <InfoMini label="Bill To Customer" value={selectedBooking?.bill_to_customer_name || resolvedCustomer?.customer_name || '-'} />
              </div>
            </div>

            {/* ===== BILLING CARD ===== */}
            {billingLoading ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> กำลังคำนวณค่าบริการ...
              </div>
            ) : billingData && billingData.charges.length > 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                    💰 ค่าบริการ ({billingData.container.dwell_days as number} วัน)
                  </h4>
                  <div className="flex items-center gap-2">
                    {resolvedCustomer ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resolvedIsCredit ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'}`}>
                        {resolvedIsCredit ? `🏢 เครดิต ${resolvedCustomer.credit_term} วัน • ` : '🏢 '}{resolvedCustomer.customer_name}
                      </span>
                    ) : null}
                    <button onClick={() => setShowCustomerPicker(v => !v)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-300">
                      {resolvedCustomer ? 'เปลี่ยนคนจ่ายเงิน' : 'เลือกคนจ่ายเงิน'}
                    </button>
                  </div>
                </div>

                {showCustomerPicker && (
                  <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Billing Customer สำหรับ Gate Out</p>
                      {billingData.owner && (
                        <p className="text-[10px] text-slate-400">เจ้าของตู้: {billingData.owner.customer_name}</p>
                      )}
                    </div>
                    <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="พิมพ์ชื่อลูกค้าเพื่อค้นหา..."
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                    <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1">
                      {filteredGateOutCustomers.length === 0 ? (
                        <p className="text-xs text-slate-400 p-2 text-center">ไม่พบลูกค้า — กรุณาเพิ่มที่ ตั้งค่า → ลูกค้า</p>
                      ) : filteredGateOutCustomers.map(c => (
                        <button key={c.customer_id} onClick={() => handleBillingCustomerChange(c.customer_id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${resolvedCustomer?.customer_id === c.customer_id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                          <span className="font-medium">{c.customer_name}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.is_line ? 'สายเรือ' : c.is_trucking ? 'รถบรรทุก' : c.is_forwarder ? 'Forwarder' : 'ทั่วไป'}
                            {c.credit_term > 0 && ` • เครดิต ${c.credit_term} วัน`}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">เมื่อเปลี่ยนคนจ่ายเงิน ระบบจะคำนวณค่าฝากและเครดิตเทอมใหม่ตามลูกค้ารายนั้น</p>
                  </div>
                )}

                {/* Customer Warning — No customer matched */}
                {!resolvedCustomer && (
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">ไม่พบข้อมูลลูกค้า — กรุณาเลือกลูกค้าก่อนชำระเงิน</p>
                    </div>
                    {!showCustomerPicker ? (
                      <button onClick={() => setShowCustomerPicker(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors">
                        <Users size={12} /> เลือกลูกค้า
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          placeholder="พิมพ์ชื่อลูกค้าเพื่อค้นหา..."
                          className="w-full h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500" />
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1">
                          {filteredGateOutCustomers.length === 0 ? (
                            <p className="text-xs text-slate-400 p-2 text-center">ไม่พบลูกค้า — กรุณาเพิ่มที่ ตั้งค่า → ลูกค้า</p>
                          ) : filteredGateOutCustomers.map(c => (
                            <button key={c.customer_id} onClick={() => handleBillingCustomerChange(c.customer_id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${manualCustomerId === c.customer_id ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700' : 'hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                              <span className="font-medium">{c.customer_name}</span>
                              <span className="text-[10px] text-slate-400">
                                {c.is_line ? 'สายเรือ' : c.is_trucking ? 'รถบรรทุก' : c.is_forwarder ? 'Forwarder' : 'ทั่วไป'}
                                {c.credit_term > 0 && ` • เครดิต ${c.credit_term} วัน`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Charges Table */}
                <div className="px-4 py-2 divide-y divide-slate-100 dark:divide-slate-700/50">
                  {billingData.charges.map((ch, i) => (
                    <div key={`t-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!selectedCharges.has(i) ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={selectedCharges.has(i)}
                        onChange={() => {
                          setSelectedCharges(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <div className="flex-1">
                        <p className="text-slate-700 dark:text-slate-200">{ch.description}</p>
                        <p className="text-[10px] text-slate-400">
                          {ch.billable_days > 0
                            ? `${ch.quantity} วัน × ฿${ch.unit_price.toLocaleString()} (ฟรี ${ch.free_days} วัน)`
                            : ch.free_days > 0
                              ? `${ch.quantity} วัน — อยู่ในช่วงฟรี`
                              : `${ch.quantity} × ฿${ch.unit_price.toLocaleString()}`
                          }
                        </p>
                      </div>
                      {ch.subtotal === 0 && ch.free_days > 0 ? (
                        <span className="w-24 h-7 flex items-center justify-end px-2 text-emerald-500 text-xs font-bold">✅ ฟรี</span>
                      ) : (
                        <input type="number" value={i in chargeOverrides ? chargeOverrides[i] : ch.subtotal}
                          onChange={(e) => setChargeOverrides(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                          className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                      )}
                    </div>
                  ))}

                  {/* Custom charges */}
                  {customCharges.map((ch, i) => (
                    <div key={`c-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!selectedCustom.has(i) ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={selectedCustom.has(i)}
                        onChange={() => {
                          setSelectedCustom(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <div className="flex-1">
                        <input type="text" value={ch.description}
                          onChange={(e) => {
                            const arr = [...customCharges];
                            arr[i] = { ...arr[i], description: e.target.value };
                            setCustomCharges(arr);
                          }}
                          className="w-full h-7 px-2 text-sm rounded border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                          placeholder="ชื่อรายการ" />
                      </div>
                      <input type="number" value={ch.subtotal}
                        onChange={(e) => {
                          const arr = [...customCharges];
                          const val = parseFloat(e.target.value) || 0;
                          arr[i] = { ...arr[i], subtotal: val, unit_price: val };
                          setCustomCharges(arr);
                        }}
                        className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                      <button onClick={() => {
                        setCustomCharges(prev => prev.filter((_, j) => j !== i));
                        setSelectedCustom(prev => {
                          const next = new Set<number>();
                          prev.forEach(v => { if (v < i) next.add(v); else if (v > i) next.add(v - 1); });
                          return next;
                        });
                      }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                </div>

                {/* Add custom charge */}
                <div className="px-4 py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                  <button onClick={() => {
                    const newCharge: BillingCharge = { charge_type: 'custom', description: '', quantity: 1, unit_price: 0, subtotal: 0, free_days: 0, billable_days: 0 };
                    setCustomCharges(prev => [...prev, newCharge]);
                    setSelectedCustom(prev => new Set([...prev, customCharges.length]));
                  }}
                    className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-colors flex items-center justify-center gap-1"
                  >+ เพิ่มรายการค่าบริการ</button>
                </div>

                {/* Summary */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>รวมก่อน VAT ({selectedCharges.size}/{billingData.charges.length} รายการ)</span>
                    <span>฿{selectedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>VAT 7%</span>
                    <span>฿{selectedVat.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-600">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span className="text-emerald-600">฿{selectedGrand.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Action */}
                {!billingPaid && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {!resolvedCustomer ? (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                          <AlertTriangle size={12} /> กรุณาเลือกลูกค้าก่อนชำระเงิน
                        </p>
                      </div>
                    ) : resolvedIsCredit ? (
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
                        <div>
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏢 ลูกค้าเครดิต — วางบิลอัตโนมัติ</p>
                          <p className="text-[10px] text-blue-500">สร้างใบแจ้งหนี้ (pending) → ปล่อยตู้ได้เลย</p>
                        </div>
                        <button disabled={!canCreateInvoice} onClick={async () => {
                          if (!selectedContainer || !resolvedCustomer) return;
                          try {
                            const creditTerm = resolvedCustomer.credit_term || 0;
                            const res = await fetch('/api/billing/invoices', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                yard_id: yardId, customer_id: resolvedCustomer.customer_id,
                                container_id: selectedContainer.container_id, charge_type: 'storage',
                                description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน)`,
                                quantity: 1, unit_price: selectedTotal,
                                due_date: new Date(Date.now() + creditTerm * 86400000).toISOString(),
                                notes: JSON.stringify({
                                  charges: buildFinalCharges(),
                                  dwell_days: billingData.container.dwell_days,
                                  container_size: billingData.container.size,
                                  payment_method: 'credit',
                                  payment_status: 'credit',
                                  document_type: 'invoice',
                                  transaction_type: 'gate_out',
                                }),
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              await createGateOutClearance('credit', data.invoice?.invoice_id || null, 'ลูกค้าเครดิต');
                              setBillingPaid(true);
                              setBillingInvoiceNumber(data.invoice_number || '');
                              setBillingInvoiceId(data.invoice?.invoice_id || null);
                            }
                          } catch (err) { console.error(err); }
                        }}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >📄 วางบิล</button>
                      </div>
                    ) : (
                      <>
                        {selectedGrand <= 0 && (
                          <button disabled={!resolvedCustomer || !canWaive} onClick={async () => {
                            try {
                              const isWaived = originalSelectedTotal > 0;
                              const reason = isWaived
                                ? window.prompt('ระบุเหตุผลการยกเว้นค่าใช้จ่าย') || ''
                                : 'ไม่มีค่าบริการ';
                              if (isWaived && !reason.trim()) return;
                              await createGateOutClearance(isWaived ? 'waived' : 'no_charge', null, reason);
                            } catch (err) { console.error(err); }
                          }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                            <CheckCircle2 size={14} />
                            {originalSelectedTotal > 0 ? 'อนุมัติยกเว้นค่าใช้จ่าย' : 'ยืนยัน No Charge ฿0'}
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 whitespace-nowrap">วิธีชำระ:</span>
                          {(['cash', 'transfer'] as const).map(m => (
                            <button key={m} onClick={() => setPaymentMethod(m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                paymentMethod === m ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                              }`}>
                              {m === 'cash' ? '💵 เงินสด' : '💳 โอน'}
                            </button>
                          ))}
                        </div>
                        <button disabled={!resolvedCustomer || !canReceivePayment} onClick={async () => {
                          if (!selectedContainer || !billingData || !resolvedCustomer) return;
                          try {
                            const custId = resolvedCustomer.customer_id;
                            const res = await fetch('/api/billing/invoices', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                yard_id: yardId, customer_id: custId,
                                container_id: selectedContainer.container_id, charge_type: 'storage',
                                description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน) — ชำระ ${paymentMethod === 'cash' ? 'เงินสด' : 'โอน'}`,
                                quantity: 1, unit_price: selectedTotal,
                                notes: JSON.stringify({
                                  charges: buildFinalCharges(),
                                  dwell_days: billingData.container.dwell_days,
                                  container_size: billingData.container.size,
                                  payment_method: paymentMethod,
                                  payment_status: 'paid',
                                  document_type: 'receipt',
                                  transaction_type: 'gate_out',
                                }),
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              await fetch('/api/billing/invoices', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invoice_id: data.invoice.invoice_id, action: 'pay' }),
                              });
                              await createGateOutClearance('paid', data.invoice?.invoice_id || null, paymentMethod === 'cash' ? 'ชำระเงินสด' : 'ชำระเงินโอน');
                              setBillingPaid(true);
                              setBillingInvoiceNumber(data.invoice_number || '');
                              setBillingInvoiceId(data.invoice?.invoice_id || null);
                            }
                          } catch (err) { console.error(err); }
                        }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >💰 รับชำระเงิน ฿{selectedGrand.toLocaleString()}</button>
                      </>
                    )}
                  </div>
                )}

                {/* Paid Confirmation */}
                {billingPaid && (
                  <div className="px-4 py-3 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                      <CheckCircle2 size={14} /> {
                        billingClearance?.clearance_type === 'no_charge' ? 'No Charge' :
                        billingClearance?.clearance_type === 'waived' ? 'Waived' :
                        billingData.is_credit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'
                      }{billingInvoiceNumber ? ` — ${billingInvoiceNumber}` : ''}
                    </span>
                    {(billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id) && (
                      <div className="flex flex-wrap justify-end gap-1">
                        <button onClick={() => {
                          const invId = billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id;
                          const printType = billingClearance?.clearance_type === 'credit' ? 'invoice' : 'receipt';
                          window.open(`/billing/print?id=${invId}&type=${printType}`, '_blank');
                        }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                        >🖨️ {billingData.is_credit ? 'พิมพ์ใบแจ้งหนี้' : 'พิมพ์ใบเสร็จ'}</button>
                        <button onClick={() => {
                          const invId = billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id;
                          const printType = billingClearance?.clearance_type === 'credit' ? 'tax_invoice_receipt' : 'receipt';
                          window.open(`/billing/print/continuous?id=${invId}&type=${printType}`, '_blank');
                        }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-50"
                        >ฟอร์มต่อเนื่อง</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : billingData && billingData.charges.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><CheckCircle2 size={14} /> ไม่มีค่าบริการ (อยู่ในช่วง Free Days หรือไม่มี Tariff)</span>
                {!billingCleared && (
                  <button onClick={() => createGateOutClearance('no_charge', null, 'ไม่มีค่าบริการ Gate-Out')}
                    disabled={!canWaive}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    ยืนยัน No Charge
                  </button>
                )}
              </div>
            ) : null}

            <GateOutReleaseRequestSection
              gateOutPhase={gateOutPhase}
              gateOutForm={gateOutForm}
              setGateOutForm={setGateOutForm}
              setShowOCR={setShowOCR}
              loadBookingByNumber={loadBookingByNumber}
              handleRequestRelease={handleRequestRelease}
              releaseLoading={releaseLoading}
              canRequestMove={canRequestMove}
              billingBlocked={!!(billingData && !billingCleared)}
              handleMarkAtGate={handleMarkAtGate}
              gateOutPhotos={gateOutPhotos}
              setGateOutPhotos={setGateOutPhotos}
              handleGateOut={handleGateOut}
              gateOutLoading={gateOutLoading}
              canGateOut={canGateOut}
            />
          </div>
        )}

        {/* Result Toast */}
        {gateOutResult && (
          <div className={`p-3 rounded-xl text-sm flex items-center justify-between gap-3 ${gateOutResult.success ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
              <span className="font-medium text-xs">{gateOutResult.message}</span>
              {gateOutResult.eir_number && (
                <>
                  <span className="text-xs font-mono">EIR: {gateOutResult.eir_number}</span>
                  <button onClick={() => onViewEIR(gateOutResult.eir_number!)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors">
                    <FileText size={12} /> พิมพ์ EIR
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setGateOutResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
          </div>
          <aside className="gate-out-side-rail space-y-3 xl:sticky xl:top-20 xl:self-start">
            <GateDecisionBar signals={gateOutDecisionSignals} compact />
            {gateOutGuardrails.alerts.length > 0 && (
              <GateGuardrailPanel title="Gate-Out checks" snapshot={gateOutGuardrails} compact />
            )}
            {gateOutVisibilityPreviewPanel}
          </aside>
        </div>
      </div>

      {/* OCR Modal */}
      {showOCR && (
        <CameraOCR
          label={showOCR === 'plate' ? 'สแกนทะเบียนรถ' : 'สแกนเลขซีล'}
          mode={showOCR === 'plate' ? 'plate' : 'seal'}
          onResult={(text) => {
            if (showOCR === 'plate') setGateOutForm(f => ({ ...f, truck_plate: text }));
            else setGateOutForm(f => ({ ...f, seal_number: text }));
            setShowOCR(null);
          }}
          onClose={() => setShowOCR(null)}
        />
      )}
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
