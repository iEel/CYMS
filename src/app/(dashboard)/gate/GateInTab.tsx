'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { validateContainerNumber } from '@/lib/containerValidation';
import {
  Loader2, CheckCircle2,
  CreditCard,
  Users,
  AlertTriangle,
  ArrowDownToLine,
} from 'lucide-react';
import CameraOCR from '@/components/gate/CameraOCR';
import GateWorkflowPanel from '@/components/gate/GateWorkflowPanel';
import GateGuardrailPanel from '@/components/gate/GateGuardrailPanel';
import GateDecisionBar from '@/components/gate/GateDecisionBar';
import { BillingCharge, BillingClearance, BillingClearanceType, GateInBillingData, OPTIONAL_CHARGES } from './types';
import { buildGateDecisionSignals, buildGateInWorkflow } from '@/lib/gateWorkflow';
import { buildGateOperationalGuardrails, type GateRecentTransaction } from '@/lib/gateOperationalGuardrails';
import { isOfflineQueuedResponse, offlineFetch } from '@/lib/offlineQueue';
import { useAuth } from '@/components/providers/AuthProvider';
import ActionInputDialog from '@/components/ui/ActionInputDialog';
import GateInContainerSection, { type GateInBookingOption, type GateInFormState } from './components/GateInContainerSection';
import GateInBusinessRelationshipSection from './components/GateInBusinessRelationshipSection';
import GateInDriverSection from './components/GateInDriverSection';
import GateInInspectionSection, { type GateInInspectionReport } from './components/GateInInspectionSection';
import GateInSubmitSection, { type GateInResultState } from './components/GateInSubmitSection';
import GateInVisibilityPreviewPanel, { type GateInVisibilityPreviewRow } from './components/GateInVisibilityPreviewPanel';
import GateInDocumentActionStrip from './components/GateInDocumentActionStrip';
import { useGatePrintReturnDraft } from './hooks/useGatePrintReturnDraft';

interface GateInTabProps {
  yardId: number;
  userId?: number;
  onViewEIR: (eirNumber: string) => void;
}

interface BookingDerivedContext {
  manualCustomerId?: number | null;
  containerOwnerId?: number | null;
  ownerName?: string | null;
  billingCustomerId?: number | null;
  truckCompanyName?: string | null;
}

type GateBillingPrintTemplateFamily = 'a4_tax_receipt' | 'continuous_tax_receipt';

type GateInPrintDraft = {
  saved_at?: number;
  yard_id?: number;
  gateInForm?: GateInFormState;
  gateInPaymentMethod?: 'cash' | 'transfer';
  gateInBillingPaid?: boolean;
  gateInInvoiceNumber?: string;
  gateInInvoiceId?: number | null;
  gateInClearance?: BillingClearance | null;
  gateInReceiptPrintOpened?: boolean;
  gateInBillingData?: GateInBillingData | null;
  gateInSelectedCharges?: number[];
  gateInChargeOverrides?: Record<number, number>;
  gateInCustomCharges?: BillingCharge[];
  gateInSelectedCustom?: number[];
  containerOwnerId?: number | null;
  billingCustomerId?: number | null;
  billingDiffFromOwner?: boolean;
  ownerSearch?: string;
  billingSearch?: string;
  manualCustomerId?: number | null;
  customerSearch?: string;
  selectedBooking?: GateInBookingOption | null;
  bookingSearch?: string;
  truckCompanySearch?: string;
  isSoc?: boolean;
  inspectionReport?: GateInInspectionReport | null;
  sealPhoto?: string;
  driverSignature?: string;
};

const GATE_IN_PRINT_DRAFT_KEY = 'cyms.gateIn.printDraft.v1';
const GATE_IN_PRINT_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export default function GateInTab({ yardId, userId, onViewEIR }: GateInTabProps) {
  const { hasPermission } = useAuth();
  const canGateIn = hasPermission('gate.in');
  const canReceivePayment = hasPermission('billing.payment.receive');
  const canCreateInvoice = hasPermission('billing.invoice.create');
  const canWaive = hasPermission('billing.waive.request');
  // Gate-In form
  const [gateInForm, setGateInForm] = useState<GateInFormState>({
    container_number: '', size: '20', type: 'GP', shipping_line: '',
    is_laden: false, seal_number: '', driver_name: '', driver_license: '',
    truck_plate: '', truck_company: '', booking_ref: '', notes: '',
    actual_gross_weight_kg: '', weight_source: 'manual',
  });
  const [sealPhoto, setSealPhoto] = useState('');
  const [driverSignature, setDriverSignature] = useState('');
  const [showOCR, setShowOCR] = useState<'container' | 'plate' | 'seal' | null>(null);
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionReport, setInspectionReport] = useState<GateInInspectionReport | null>(null);

  // Check Digit + Boxtech states
  const [containerValid, setContainerValid] = useState<null | boolean>(null);
  const [checkDigitError, setCheckDigitError] = useState('');
  const [boxtechLoading, setBoxtechLoading] = useState(false);
  const [boxtechResult, setBoxtechResult] = useState<{
    shipping_line?: string; size?: string; type?: string; source?: string;
    tare_weight_kg?: number;
    max_gross_weight_kg?: number;
    tare_kg?: number;
    max_gross_mass_kg?: number;
    group_st?: string;
    customer?: { customer_id: number; customer_name: string; credit_term: number } | null;
    unknown_prefix?: boolean;
    multiple_customers?: boolean;
    customer_source?: string;
    candidates?: Array<{ customer_id: number; customer_name: string; is_line: boolean; is_forwarder: boolean; is_trucking: boolean; credit_term: number; is_primary: boolean }>;
  } | null>(null);
  const boxtechAbortRef = useRef<AbortController | null>(null);
  const boxtechTareWeightKg = boxtechResult?.tare_weight_kg || boxtechResult?.tare_kg || null;
  const boxtechMaxGrossWeightKg = boxtechResult?.max_gross_weight_kg || boxtechResult?.max_gross_mass_kg || null;
  const actualGrossWeightKg = gateInForm.actual_gross_weight_kg ? Number(gateInForm.actual_gross_weight_kg) : null;
  const cargoWeightEstimateKg = actualGrossWeightKg && boxtechTareWeightKg ? Math.max(actualGrossWeightKg - boxtechTareWeightKg, 0) : null;
  const weightOverMaxGross = Boolean(actualGrossWeightKg && boxtechMaxGrossWeightKg && actualGrossWeightKg > boxtechMaxGrossWeightKg);

  // Gate-In Billing states
  const [gateInBillingData, setGateInBillingData] = useState<GateInBillingData | null>(null);
  const [gateInBillingLoading, setGateInBillingLoading] = useState(false);
  const [gateInPaymentMethod, setGateInPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [gateInBillingPaid, setGateInBillingPaid] = useState(false);
  const [gateInInvoiceNumber, setGateInInvoiceNumber] = useState('');
  const [gateInInvoiceId, setGateInInvoiceId] = useState<number | null>(null);
  const [gateInClearance, setGateInClearance] = useState<BillingClearance | null>(null);
  const [gateInReceiptPrintOpened, setGateInReceiptPrintOpened] = useState(false);
  const [gateInSelectedCharges, setGateInSelectedCharges] = useState<Set<number>>(new Set());
  const [gateInChargeOverrides, setGateInChargeOverrides] = useState<Record<number, number>>({});
  const [gateInCustomCharges, setGateInCustomCharges] = useState<BillingCharge[]>([]);
  const [gateInSelectedCustom, setGateInSelectedCustom] = useState<Set<number>>(new Set());
  const [gateInPayLoading, setGateInPayLoading] = useState(false);
  const [gateInWaiveDialogOpen, setGateInWaiveDialogOpen] = useState(false);

  // Manual customer selection (when no auto-match)
  const [customerList, setCustomerList] = useState<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; credit_term: number }[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [manualCustomerId, setManualCustomerId] = useState<number | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Owner / Billing customer separation
  const [containerOwnerId, setContainerOwnerId] = useState<number | null>(null);
  const [billingCustomerId, setBillingCustomerId] = useState<number | null>(null);
  const [billingDiffFromOwner, setBillingDiffFromOwner] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
  const ownerSearchRef = useRef<HTMLDivElement>(null);
  const [billingSearch, setBillingSearch] = useState('');
  const [billingSearchOpen, setBillingSearchOpen] = useState(false);
  const billingSearchRef = useRef<HTMLDivElement>(null);
  const [isSoc, setIsSoc] = useState(false);

  // Truck company searchable combobox
  const [truckCompanySearch, setTruckCompanySearch] = useState('');
  const [truckCompanyOpen, setTruckCompanyOpen] = useState(false);
  const truckCompanyRef = useRef<HTMLDivElement>(null);

  // Close owner search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ownerSearchRef.current && !ownerSearchRef.current.contains(e.target as Node)) {
        setOwnerSearchOpen(false);
      }
    };
    if (ownerSearchOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ownerSearchOpen]);

  // Close billing search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (billingSearchRef.current && !billingSearchRef.current.contains(e.target as Node)) {
        setBillingSearchOpen(false);
      }
    };
    if (billingSearchOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [billingSearchOpen]);

  // Close truck company dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (truckCompanyRef.current && !truckCompanyRef.current.contains(e.target as Node)) {
        setTruckCompanyOpen(false);
      }
    };
    if (truckCompanyOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [truckCompanyOpen]);

  // Halt Rule popup (multi-customer prefix conflict)
  const [showHaltPopup, setShowHaltPopup] = useState(false);
  const [haltCandidates, setHaltCandidates] = useState<Array<{ customer_id: number; customer_name: string; is_line: boolean; is_forwarder: boolean; is_trucking: boolean; credit_term: number; is_primary: boolean }>>([]);

  const [gateInLoading, setGateInLoading] = useState(false);
  const [gateInResult, setGateInResult] = useState<GateInResultState | null>(null);
  const [recentGateTransactions, setRecentGateTransactions] = useState<GateRecentTransaction[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<GateInBookingOption | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingResults, setBookingResults] = useState<GateInBookingOption[]>([]);
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false);
  const [bookingSearchError, setBookingSearchError] = useState('');
  const bookingDerivedContextRef = useRef<BookingDerivedContext>({});
  const [visibilityPreview, setVisibilityPreview] = useState<GateInVisibilityPreviewRow[]>([]);
  const [visibilityPreviewLoading, setVisibilityPreviewLoading] = useState(false);
  const [visibilityPreviewError, setVisibilityPreviewError] = useState('');
  const visibilityPreviewRequestRef = useRef(0);
  const restoredGateInInvoiceIdRef = useRef<number | null>(null);
  const restoredGateInBillingSnapshotRef = useRef(false);
  const gateInPrintDraft = useGatePrintReturnDraft<GateInPrintDraft>({
    storageKey: GATE_IN_PRINT_DRAFT_KEY,
    label: 'Gate-In print draft',
    isValidDraft: draft => draft.yard_id === yardId
      && Boolean(draft.saved_at)
      && Date.now() - Number(draft.saved_at) <= GATE_IN_PRINT_DRAFT_MAX_AGE_MS,
  });
  const resolvedTruckingCompanyId = useMemo(
    () => selectedBooking?.trucking_company_id || customerList.find(c => c.customer_name === gateInForm.truck_company)?.customer_id || null,
    [selectedBooking, customerList, gateInForm.truck_company]
  );

  const clearBookingDerivedContext = () => {
    const context = bookingDerivedContextRef.current;
    if (context.manualCustomerId) {
      setManualCustomerId(prev => prev === context.manualCustomerId ? null : prev);
    }
    if (context.containerOwnerId) {
      setContainerOwnerId(prev => prev === context.containerOwnerId ? null : prev);
    }
    if (context.ownerName) {
      setOwnerSearch(prev => prev === context.ownerName ? '' : prev);
    }
    if (context.billingCustomerId) {
      setBillingCustomerId(prev => prev === context.billingCustomerId ? null : prev);
    }
    if (context.truckCompanyName) {
      setGateInForm(prev => ({
        ...prev,
        truck_company: prev.truck_company === context.truckCompanyName ? '' : prev.truck_company,
      }));
      setTruckCompanySearch(prev => prev === context.truckCompanyName ? '' : prev);
    }
    bookingDerivedContextRef.current = {};
  };

  const resetGateInOwnerBillingContext = () => {
    setContainerOwnerId(null);
    setBillingCustomerId(null);
    setBillingDiffFromOwner(false);
    setOwnerSearch('');
    setOwnerSearchOpen(false);
    setBillingSearch('');
    setBillingSearchOpen(false);
    setManualCustomerId(null);
    setCustomerSearch('');
    setShowCustomerPicker(false);
    setSelectedBooking(null);
    setBookingSearch('');
    setBookingResults([]);
    setShowBookingPicker(false);
    setBookingSearchError('');
    setTruckCompanySearch('');
    bookingDerivedContextRef.current = {};
  };

  const restoreGateInPrintDraft = () => {
    const draft = gateInPrintDraft.restoreDraft();
    if (!draft) return;
    if (draft.gateInForm) setGateInForm(draft.gateInForm);
    if (draft.gateInPaymentMethod) setGateInPaymentMethod(draft.gateInPaymentMethod);
    setGateInBillingPaid(Boolean(draft.gateInBillingPaid));
    setGateInInvoiceNumber(draft.gateInInvoiceNumber || '');
    setGateInInvoiceId(draft.gateInInvoiceId || null);
    setGateInClearance(draft.gateInClearance || null);
    setGateInReceiptPrintOpened(Boolean(draft.gateInReceiptPrintOpened));
    if (draft.gateInBillingData) setGateInBillingData(draft.gateInBillingData);
    if (draft.gateInSelectedCharges) setGateInSelectedCharges(new Set(draft.gateInSelectedCharges));
    if (draft.gateInChargeOverrides) setGateInChargeOverrides(draft.gateInChargeOverrides);
    if (draft.gateInCustomCharges) setGateInCustomCharges(draft.gateInCustomCharges);
    if (draft.gateInSelectedCustom) setGateInSelectedCustom(new Set(draft.gateInSelectedCustom));
    setContainerOwnerId(draft.containerOwnerId || null);
    setBillingCustomerId(draft.billingCustomerId || null);
    setBillingDiffFromOwner(Boolean(draft.billingDiffFromOwner));
    setOwnerSearch(draft.ownerSearch || '');
    setBillingSearch(draft.billingSearch || '');
    setManualCustomerId(draft.manualCustomerId || null);
    setCustomerSearch(draft.customerSearch || '');
    setSelectedBooking(draft.selectedBooking || null);
    setBookingSearch(draft.bookingSearch || '');
    setTruckCompanySearch(draft.truckCompanySearch || '');
    setIsSoc(Boolean(draft.isSoc));
    setInspectionReport(draft.inspectionReport || null);
    setSealPhoto(draft.sealPhoto || '');
    setDriverSignature(draft.driverSignature || '');
    restoredGateInInvoiceIdRef.current = draft.gateInInvoiceId || null;
    restoredGateInBillingSnapshotRef.current = Boolean(draft.gateInBillingData);
  };

  const persistGateInPrintDraft = (overrides?: { gateInReceiptPrintOpened?: boolean }) => {
    gateInPrintDraft.saveDraft({
      saved_at: Date.now(),
      yard_id: yardId,
      gateInForm,
      gateInPaymentMethod,
      gateInBillingPaid,
      gateInInvoiceNumber,
      gateInInvoiceId,
      gateInClearance,
      gateInReceiptPrintOpened: overrides?.gateInReceiptPrintOpened ?? gateInReceiptPrintOpened,
      gateInBillingData,
      gateInSelectedCharges: Array.from(gateInSelectedCharges),
      gateInChargeOverrides,
      gateInCustomCharges,
      gateInSelectedCustom: Array.from(gateInSelectedCustom),
      containerOwnerId,
      billingCustomerId,
      billingDiffFromOwner,
      ownerSearch,
      billingSearch,
      manualCustomerId,
      customerSearch,
      selectedBooking,
      bookingSearch,
      truckCompanySearch,
      isSoc,
      inspectionReport,
      sealPhoto,
      driverSignature,
    });
  };

  useEffect(() => {
    restoreGateInPrintDraft();
    // Restore once when the Gate-In workstation mounts after returning from a print tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yardId]);

  const applyGateInBooking = (booking: GateInBookingOption | null) => {
    clearBookingDerivedContext();
    setSelectedBooking(booking);
    setShowBookingPicker(false);
    setBookingSearchError('');
    setGateInForm(prev => ({ ...prev, booking_ref: booking?.booking_number || '' }));
    if (!booking) {
      setBookingSearch('');
      setBookingResults([]);
      return;
    }
    const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null;
    const bookingBillingCustomerId = booking.bill_to_customer_id || (!billingDiffFromOwner && booking.shipping_line_id ? booking.shipping_line_id : null);
    setBookingSearch(booking.booking_number);
    if (bookingCustomerId) setManualCustomerId(bookingCustomerId);
    if (booking.bill_to_customer_id) setBillingCustomerId(booking.bill_to_customer_id);
    if (booking.shipping_line_id) {
      setContainerOwnerId(booking.shipping_line_id);
      setOwnerSearch(booking.shipping_line_name || '');
      if (!billingDiffFromOwner && !booking.bill_to_customer_id) setBillingCustomerId(booking.shipping_line_id);
    }
    if (booking.trucking_company_name) {
      setGateInForm(prev => ({ ...prev, truck_company: booking.trucking_company_name || prev.truck_company }));
      setTruckCompanySearch(booking.trucking_company_name || '');
    }
    bookingDerivedContextRef.current = {
      manualCustomerId: bookingCustomerId,
      containerOwnerId: booking.shipping_line_id || null,
      ownerName: booking.shipping_line_name || null,
      billingCustomerId: bookingBillingCustomerId,
      truckCompanyName: booking.trucking_company_name || null,
    };
  };

  const searchBookings = async () => {
    const query = bookingSearch.trim();
    setShowBookingPicker(true);
    setBookingSearchError('');
    if (bookingSearchLoading) return;
    if (!query) {
      setBookingResults([]);
      return;
    }
    setBookingSearchLoading(true);
    try {
      const res = await fetch(`/api/edi/bookings?lookup=1&booking_number=${encodeURIComponent(query)}&yard_id=${yardId}`);
      if (!res.ok) throw new Error('Booking search failed');
      const json = await res.json();
      setBookingResults(json.booking ? [json.booking] : []);
      if (!json.booking) setBookingSearchError('ไม่พบ Booking');
    } catch (err) {
      console.error('Booking search error:', err);
      setBookingResults([]);
      setBookingSearchError('ค้นหา Booking ไม่สำเร็จ');
    } finally {
      setBookingSearchLoading(false);
    }
  };

  const handleBookingSearchChange = (value: string) => {
    setBookingSearch(value);
    setShowBookingPicker(true);
    setBookingSearchError('');
    setGateInForm(prev => ({ ...prev, booking_ref: value }));
    if (selectedBooking) {
      setSelectedBooking(null);
      clearBookingDerivedContext();
    }
    if (!value) setBookingResults([]);
  };

  const handleOwnerSearchChange = (value: string) => {
    const selectedOwnerName = containerOwnerId ? customerList.find(c => c.customer_id === containerOwnerId)?.customer_name || '' : '';
    const previousOwnerId = containerOwnerId;
    setOwnerSearch(value);
    setOwnerSearchOpen(true);
    if (!value || (previousOwnerId && value !== selectedOwnerName)) {
      setContainerOwnerId(null);
      if (!billingDiffFromOwner && billingCustomerId === previousOwnerId) setBillingCustomerId(null);
    }
  };

  // === Check Digit Validation + Boxtech Auto-Lookup ===
  useEffect(() => {
    const num = gateInForm.container_number.toUpperCase().replace(/[\s-]/g, '');
    
    if (num.length < 11) {
      setContainerValid(null);
      setCheckDigitError('');
      setBoxtechResult(null);
      return;
    }
    
    const result = validateContainerNumber(num);
    if (!result.valid) {
      setContainerValid(false);
      setCheckDigitError(result.error || 'Invalid');
      setBoxtechResult(null);
      return;
    }
    
    setContainerValid(true);
    setCheckDigitError('');
    
    if (boxtechAbortRef.current) boxtechAbortRef.current.abort();
    const controller = new AbortController();
    boxtechAbortRef.current = controller;
    
    setBoxtechLoading(true);
    const bUrl = `/api/boxtech?container_number=${num}${gateInForm.booking_ref ? `&booking_ref=${encodeURIComponent(gateInForm.booking_ref)}` : ''}`;
    fetch(bUrl, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          setBoxtechResult(null);
          return;
        }
        setBoxtechResult(data);
        setGateInForm(prev => ({
          ...prev,
          shipping_line: data.shipping_line || prev.shipping_line,
          size: data.size || prev.size,
          type: data.type || prev.type,
        }));

        // Handle customer resolution
        if (data.customer) {
          setContainerOwnerId(data.customer.customer_id);
          setOwnerSearch(data.customer.customer_name || '');
          if (!billingDiffFromOwner) setBillingCustomerId(data.customer.customer_id);
        }
        // HALT RULE: Multiple customers for same prefix → force popup
        if (data.multiple_customers && data.candidates?.length > 0) {
          setHaltCandidates(data.candidates);
          setShowHaltPopup(true);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Boxtech lookup error:', err);
      })
      .finally(() => setBoxtechLoading(false));

    // Auto-lookup Booking Ref
    fetch(`/api/edi/bookings?lookup=1&container_number=${num}&yard_id=${yardId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.booking && !gateInForm.booking_ref) {
          applyGateInBooking(data.booking);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Booking lookup error:', err);
      });
    
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateInForm.container_number]);

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

  useEffect(() => {
    const normalizedContainerNumber = gateInForm.container_number.toUpperCase().replace(/[\s-]/g, '');
    if (normalizedContainerNumber.length !== 11 || containerValid !== true) {
      visibilityPreviewRequestRef.current += 1;
      setVisibilityPreview([]);
      setVisibilityPreviewError('');
      setVisibilityPreviewLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestId = visibilityPreviewRequestRef.current + 1;
    visibilityPreviewRequestRef.current = requestId;
    setVisibilityPreviewLoading(true);
    setVisibilityPreviewError('');
    fetch('/api/gate/visibility-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        yard_id: yardId,
        container_number: normalizedContainerNumber,
        booking_id: selectedBooking?.booking_id || null,
        container_owner_id: containerOwnerId,
        booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId,
        billing_customer_id: billingCustomerId,
        trucking_company_id: resolvedTruckingCompanyId || null,
        driver_user_id: null,
      }),
    })
      .then(async res => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || !Array.isArray(json.preview)) {
          throw new Error('Visibility preview unavailable');
        }
        if (visibilityPreviewRequestRef.current === requestId) {
          setVisibilityPreview(json.preview);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError' && visibilityPreviewRequestRef.current === requestId) {
          console.error('visibility preview error', err);
          setVisibilityPreview([]);
          setVisibilityPreviewError('Visibility preview unavailable');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && visibilityPreviewRequestRef.current === requestId) {
          setVisibilityPreviewLoading(false);
        }
      });
    return () => controller.abort();
  }, [gateInForm.container_number, containerValid, containerOwnerId, selectedBooking, manualCustomerId, billingCustomerId, resolvedTruckingCompanyId, yardId]);

  // Fetch gate-in billing when form has valid data
  useEffect(() => {
    if (containerValid !== true) {
      if (restoredGateInBillingSnapshotRef.current && containerValid === null) return;
      restoredGateInBillingSnapshotRef.current = false;
      restoredGateInInvoiceIdRef.current = null;
      setGateInBillingData(null);
      setGateInBillingPaid(false);
      setGateInReceiptPrintOpened(false);
      return;
    }
    if (restoredGateInBillingSnapshotRef.current) {
      restoredGateInBillingSnapshotRef.current = false;
      restoredGateInInvoiceIdRef.current = null;
      return;
    }
    setGateInBillingLoading(true);
    fetch('/api/billing/gate-in-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yard_id: yardId,
        container_number: gateInForm.container_number,
        size: gateInForm.size,
        shipping_line: gateInForm.shipping_line,
        booking_ref: gateInForm.booking_ref || undefined,
        container_owner_id: containerOwnerId || undefined,
        billing_customer_id: billingCustomerId || undefined,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.charges) {
          setGateInBillingData(data);
          const selected = new Set<number>();
          data.charges.forEach((ch: BillingCharge, i: number) => {
            if (!OPTIONAL_CHARGES.includes(ch.charge_type)) selected.add(i);
          });
          setGateInSelectedCharges(selected);
          setGateInChargeOverrides({});
          setGateInCustomCharges([]);
          setGateInSelectedCustom(new Set());
          if (restoredGateInInvoiceIdRef.current) {
            restoredGateInInvoiceIdRef.current = null;
          } else {
            setGateInBillingPaid(false);
            setGateInReceiptPrintOpened(false);
            setGateInClearance(null);
            setGateInInvoiceNumber('');
            setGateInInvoiceId(null);
            setManualCustomerId(null);
            setShowCustomerPicker(false);
          }
        }
      })
      .catch(err => console.error('Gate-in billing fetch error:', err))
      .finally(() => setGateInBillingLoading(false));
  }, [
    containerValid,
    gateInForm.container_number,
    gateInForm.size,
    gateInForm.shipping_line,
    gateInForm.booking_ref,
    containerOwnerId,
    billingCustomerId,
    yardId,
  ]);

  // Gate-In billing helpers
  const getGateInChargeSubtotal = (i: number) => {
    if (i in gateInChargeOverrides) return gateInChargeOverrides[i];
    return gateInBillingData?.charges[i]?.subtotal ?? 0;
  };
  const gateInSelectedTotal = (gateInBillingData ? gateInBillingData.charges
    .reduce((s, _, i) => s + (gateInSelectedCharges.has(i) ? getGateInChargeSubtotal(i) : 0), 0) : 0)
    + gateInCustomCharges.filter((_, i) => gateInSelectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const gateInSelectedVat = Math.round(gateInSelectedTotal * 0.07 * 100) / 100;
  const gateInSelectedGrand = gateInSelectedTotal + gateInSelectedVat;
  const gateInOriginalSelectedTotal = (gateInBillingData ? gateInBillingData.charges
    .reduce((s, ch, i) => s + (gateInSelectedCharges.has(i) ? ch.subtotal : 0), 0) : 0)
    + gateInCustomCharges.filter((_, i) => gateInSelectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const gateInBillingCleared = gateInBillingPaid || !!gateInClearance;
  const buildGateInFinalCharges = () => {
    const final: BillingCharge[] = [];
    if (gateInBillingData) {
      gateInBillingData.charges.forEach((ch, i) => {
        if (gateInSelectedCharges.has(i)) {
          final.push({ ...ch, subtotal: getGateInChargeSubtotal(i), unit_price: i in gateInChargeOverrides ? gateInChargeOverrides[i] : ch.unit_price });
        }
      });
    }
    gateInCustomCharges.forEach((ch, i) => { if (gateInSelectedCustom.has(i)) final.push(ch); });
    return final;
  };
  const gateInRequiresBillingClearance = !!gateInBillingData;

  const createGateInClearance = async (
    clearanceType: BillingClearanceType,
    invoiceId?: number | null,
    reason?: string
  ) => {
    const res = await fetch('/api/billing/clearance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yard_id: yardId,
        transaction_type: 'gate_in',
        container_number: gateInForm.container_number,
        customer_id: resolvedCustomer?.customer_id,
        clearance_type: clearanceType,
        original_amount: gateInOriginalSelectedTotal,
        final_amount: gateInSelectedTotal,
        reason,
        invoice_id: invoiceId || null,
        approved_by: clearanceType === 'waived' ? userId : null,
        charges: buildGateInFinalCharges(),
        user_id: userId,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Billing clearance failed');
    setGateInClearance({
      clearance_id: data.clearance_id,
      clearance_type: clearanceType,
      reason,
      invoice_id: invoiceId || null,
    });
    setGateInBillingPaid(true);
    return data.clearance_id as number;
  };

  const submitGateInWaiver = async (reason: string) => {
    setGateInPayLoading(true);
    try {
      await createGateInClearance('waived', null, reason);
    } catch (err) {
      console.error(err);
    } finally {
      setGateInPayLoading(false);
      setGateInWaiveDialogOpen(false);
    }
  };

  const handleGateInNoChargeOrWaive = async () => {
    if (gateInOriginalSelectedTotal > 0) {
      setGateInWaiveDialogOpen(true);
      return;
    }

    setGateInPayLoading(true);
    try {
      await createGateInClearance('no_charge', null, 'ไม่มีค่าบริการ');
    } catch (err) {
      console.error(err);
    } finally {
      setGateInPayLoading(false);
    }
  };

  // Resolved customer: auto-matched or manually selected
  const resolvedCustomer = useMemo(() => {
    if (billingCustomerId) {
      const c = customerList.find(c => c.customer_id === billingCustomerId);
      if (c) return { customer_id: c.customer_id, customer_name: c.customer_name, credit_term: c.credit_term };
    }
    if (gateInBillingData?.customer) return gateInBillingData.customer;
    if (manualCustomerId) {
      const c = customerList.find(c => c.customer_id === manualCustomerId);
      if (c) return { customer_id: c.customer_id, customer_name: c.customer_name, credit_term: c.credit_term };
    }
    return null;
  }, [billingCustomerId, gateInBillingData?.customer, manualCustomerId, customerList]);
  const resolvedIsCredit = resolvedCustomer ? (resolvedCustomer.credit_term || 0) > 0 : false;

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customerList.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customerList.filter(c => c.customer_name.toLowerCase().includes(q)).slice(0, 10);
  }, [customerList, customerSearch]);

  // Gate-In submit
  const handleGateIn = async () => {
    if (!canGateIn) return;
    if (!gateInForm.container_number) return;
    if (containerValid === false) return;
    if (weightOverMaxGross) {
      setGateInResult({ success: false, message: '❌ น้ำหนัก Actual Gross/VGM เกิน Max Gross ของตู้' });
      return;
    }
    setGateInLoading(true);
    setGateInResult(null);
    try {
      const res = await offlineFetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_in',
          yard_id: yardId,
          user_id: userId,
          ...gateInForm,
          is_soc: isSoc,
          container_owner_id: containerOwnerId || undefined,
          booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId || undefined,
          billing_customer_id: billingCustomerId || undefined,
          trucking_company_id: resolvedTruckingCompanyId || undefined,
          driver_user_id: undefined,
          billing_clearance_id: gateInClearance?.clearance_id || undefined,
          tare_weight_kg: boxtechTareWeightKg || null,
          max_gross_weight_kg: boxtechMaxGrossWeightKg || null,
          boxtech_group_st: boxtechResult?.group_st || null,
          boxtech_source: boxtechResult?.source === 'boxtech' ? 'boxtech' : null,
          actual_gross_weight_kg: gateInForm.actual_gross_weight_kg ? Number(gateInForm.actual_gross_weight_kg) : null,
          weight_source: gateInForm.actual_gross_weight_kg ? gateInForm.weight_source : null,
          damage_report: inspectionReport || null,
        }),
      }, { operation: 'gate_in' });
      const data = await res.json();
      if (isOfflineQueuedResponse(data)) {
        gateInPrintDraft.clearDraft();
        setGateInResult({ success: true, message: `บันทึก Gate-In ${gateInForm.container_number} เข้าคิวออฟไลน์แล้ว — จะซิงค์เมื่อออนไลน์` });
        setGateInForm({ container_number: '', size: '20', type: 'GP', shipping_line: '', is_laden: false, seal_number: '', driver_name: '', driver_license: '', truck_plate: '', truck_company: '', booking_ref: '', notes: '', actual_gross_weight_kg: '', weight_source: 'manual' });
        resetGateInOwnerBillingContext();
        setGateInClearance(null);
        setGateInReceiptPrintOpened(false);
        setInspectionReport(null);
        setBoxtechResult(null);
        setContainerValid(null);
        setTimeout(() => setGateInResult(null), 15000);
        return;
      }
      if (data.success) {
        if (boxtechResult?.unknown_prefix) {
          fetch('/api/yard/audit-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              yard_id: yardId,
              action: 'unknown_prefix_alert',
              entity_type: 'container',
              entity_id: data.container_id,
              details: JSON.stringify({
                prefix: gateInForm.container_number.substring(0, 4),
                container_number: gateInForm.container_number,
                message: `Prefix ${gateInForm.container_number.substring(0, 4)} ไม่มีในระบบ — กรุณาเพิ่มใน Settings > Prefix Mapping`,
              }),
            }),
          }).catch(err => console.warn('Audit log for unknown prefix failed:', err));
        }

        setGateInResult({ success: true, message: `✅ รับตู้ ${gateInForm.container_number} เข้าลานสำเร็จ`, eir_number: data.eir_number, assigned_location: data.assigned_location });
        gateInPrintDraft.clearDraft();
        setGateInForm({ container_number: '', size: '20', type: 'GP', shipping_line: '', is_laden: false, seal_number: '', driver_name: '', driver_license: '', truck_plate: '', truck_company: '', booking_ref: '', notes: '', actual_gross_weight_kg: '', weight_source: 'manual' });
        resetGateInOwnerBillingContext();
        setGateInClearance(null);
        setGateInReceiptPrintOpened(false);
        setInspectionReport(null);
        setBoxtechResult(null);
        setContainerValid(null);
        setTimeout(() => setGateInResult(null), 15000);
      } else {
        setGateInResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateInResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateInLoading(false); }
  };

  const openGateInBillingPrint = (options: { templateFamily: GateBillingPrintTemplateFamily }) => {
    if (!gateInInvoiceId) return;
    persistGateInPrintDraft({ gateInReceiptPrintOpened: true });
    setGateInReceiptPrintOpened(true);
    const params = new URLSearchParams({
      id: String(gateInInvoiceId),
      type: 'tax_invoice_receipt',
      templateFamily: options.templateFamily,
      returnTo: '/gate?tab=gate_in',
    });
    const url = `/billing/print/continuous?${params.toString()}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  };

  // OCR callback
  const handleOCRResult = (text: string) => {
    if (showOCR === 'container') setGateInForm(f => ({ ...f, container_number: text }));
    else if (showOCR === 'plate') setGateInForm(f => ({ ...f, truck_plate: text }));
    else if (showOCR === 'seal') setGateInForm(f => ({ ...f, seal_number: text }));
    setShowOCR(null);
  };

  const gateInWorkflow = useMemo(() => buildGateInWorkflow({
    containerNumber: gateInForm.container_number,
    containerValid,
    ownerResolved: !!containerOwnerId || !!resolvedCustomer,
    billingCustomerResolved: !!billingCustomerId || !!resolvedCustomer,
    billingRequired: gateInRequiresBillingClearance,
    billingCleared: gateInBillingCleared,
    inspectionComplete: !!inspectionReport,
    sealRequired: gateInForm.is_laden,
    sealCaptured: !!sealPhoto,
    submitted: !!gateInResult?.success,
    halted: showHaltPopup,
    canSubmit: canGateIn,
  }), [
    billingCustomerId,
    canGateIn,
    containerOwnerId,
    containerValid,
    gateInBillingCleared,
    gateInForm.container_number,
    gateInForm.is_laden,
    gateInRequiresBillingClearance,
    gateInResult?.success,
    inspectionReport,
    resolvedCustomer,
    sealPhoto,
    showHaltPopup,
  ]);

  const gateInGuardrails = useMemo(() => buildGateOperationalGuardrails({
    mode: 'gate_in',
    form: gateInForm,
    recentTransactions: recentGateTransactions,
    inspectionCompleteness: inspectionReport?.photo_completeness || null,
    sealPhotoCaptured: !!sealPhoto,
  }), [gateInForm, inspectionReport?.photo_completeness, recentGateTransactions, sealPhoto]);
  const gateInDecisionSignals = useMemo(() => {
    const photoRequired = (inspectionReport?.photo_completeness?.required || (inspectionReport ? 1 : 0)) + (gateInForm.is_laden ? 1 : 0);
    const photoCompleted = (inspectionReport?.photo_completeness?.completed || (inspectionReport ? 1 : 0)) + (gateInForm.is_laden && sealPhoto ? 1 : 0);
    return buildGateDecisionSignals({
      mode: 'gate_in',
      workflow: gateInWorkflow,
      billingRequired: gateInRequiresBillingClearance,
      billingCleared: gateInBillingCleared,
      bookingSelected: !!gateInForm.booking_ref,
      evidenceComplete: !!inspectionReport && (!gateInForm.is_laden || !!sealPhoto),
      photoCompleted,
      photoRequired,
      canSubmit: canGateIn,
    });
  }, [
    canGateIn,
    gateInBillingCleared,
    gateInForm.booking_ref,
    gateInForm.is_laden,
    gateInRequiresBillingClearance,
    gateInWorkflow,
    inspectionReport,
    sealPhoto,
  ]);
  const gateInEirStep = gateInWorkflow.steps.find(step => step.id === 'eir');
  const gateInEirStepActive = gateInEirStep?.status === 'active';
  const gateInEirIssued = gateInEirStep?.status === 'done';
  const gateInClearanceLabel =
    gateInClearance?.clearance_type === 'no_charge' ? 'No Charge ยืนยันแล้ว' :
    gateInClearance?.clearance_type === 'waived' ? 'อนุมัติยกเว้นค่าใช้จ่ายแล้ว' :
    gateInClearance?.clearance_type === 'credit' ? 'วางบิลเรียบร้อยแล้ว' :
    gateInBillingCleared ? 'ชำระเงินเรียบร้อยแล้ว' :
    'ยังไม่เคลียร์ค่าใช้จ่าย';

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
              <ArrowDownToLine size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">รับตู้เข้าลาน (Gate-In)</h3>
              <p className="text-xs text-slate-400">กรอกข้อมูลตู้, คนขับ, และทะเบียนรถ → ระบบจะสร้าง EIR อัตโนมัติ</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <GateWorkflowPanel title="Gate-In guided workflow" workflow={gateInWorkflow} />
          <div className="gate-in-workstation-shell grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <div className="gate-in-primary-workspace space-y-4">

          <GateInContainerSection
            gateInForm={gateInForm}
            setGateInForm={setGateInForm}
            containerValid={containerValid}
            checkDigitError={checkDigitError}
            boxtechLoading={boxtechLoading}
            boxtechResult={boxtechResult}
            boxtechTareWeightKg={boxtechTareWeightKg}
            boxtechMaxGrossWeightKg={boxtechMaxGrossWeightKg}
            cargoWeightEstimateKg={cargoWeightEstimateKg}
            weightOverMaxGross={weightOverMaxGross}
            selectedBooking={selectedBooking}
            bookingSearch={bookingSearch}
            bookingResults={bookingResults}
            showBookingPicker={showBookingPicker}
            setShowBookingPicker={setShowBookingPicker}
            bookingSearchLoading={bookingSearchLoading}
            bookingSearchError={bookingSearchError}
            isSoc={isSoc}
            setIsSoc={setIsSoc}
            setShowOCR={setShowOCR}
            applyGateInBooking={applyGateInBooking}
            handleBookingSearchChange={handleBookingSearchChange}
            searchBookings={searchBookings}
          />

          <GateInBusinessRelationshipSection
            customerList={customerList}
            resolvedCustomer={resolvedCustomer}
            containerOwnerId={containerOwnerId}
            setContainerOwnerId={setContainerOwnerId}
            billingCustomerId={billingCustomerId}
            setBillingCustomerId={setBillingCustomerId}
            billingDiffFromOwner={billingDiffFromOwner}
            setBillingDiffFromOwner={setBillingDiffFromOwner}
            ownerSearch={ownerSearch}
            setOwnerSearch={setOwnerSearch}
            ownerSearchOpen={ownerSearchOpen}
            setOwnerSearchOpen={setOwnerSearchOpen}
            ownerSearchRef={ownerSearchRef}
            billingSearch={billingSearch}
            setBillingSearch={setBillingSearch}
            billingSearchOpen={billingSearchOpen}
            setBillingSearchOpen={setBillingSearchOpen}
            billingSearchRef={billingSearchRef}
            handleOwnerSearchChange={handleOwnerSearchChange}
          />

          <GateInDriverSection
            gateInForm={gateInForm}
            setGateInForm={setGateInForm}
            customerList={customerList}
            truckCompanySearch={truckCompanySearch}
            setTruckCompanySearch={setTruckCompanySearch}
            truckCompanyOpen={truckCompanyOpen}
            setTruckCompanyOpen={setTruckCompanyOpen}
            truckCompanyRef={truckCompanyRef}
            setShowOCR={setShowOCR}
          />

          <GateInInspectionSection
            gateInForm={gateInForm}
            sealPhoto={sealPhoto}
            setSealPhoto={setSealPhoto}
            driverSignature={driverSignature}
            setDriverSignature={setDriverSignature}
            showInspection={showInspection}
            setShowInspection={setShowInspection}
            inspectionReport={inspectionReport}
            setInspectionReport={setInspectionReport}
          />

          {/* Extracted sections retain: เลือก Booking; Booking Customer; Container owner; Billing customer; Business relationship; Forwarder; Consignee; Bill To Customer; Tare Weight; Max Gross; Actual Gross / VGM; gateInForm.is_laden && (; onKeyDown; Number(boxtechTareWeightKg).toLocaleString(); Number(boxtechMaxGrossWeightKg).toLocaleString() */}

          {/* ===== GATE-IN BILLING CARD ===== */}
          {gateInBillingLoading ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> กำลังคำนวณค่าบริการ...
            </div>
          ) : gateInBillingData && gateInBillingData.charges.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-900/10 dark:to-emerald-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                  💰 ค่าบริการ Gate-In
                </h4>
                {resolvedCustomer ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resolvedIsCredit ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'}`}>
                    {resolvedIsCredit ? `🏢 เครดิต ${resolvedCustomer.credit_term} วัน • ` : '🏢 '}{resolvedCustomer.customer_name}
                  </span>
                ) : null}
              </div>

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
                        {filteredCustomers.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2 text-center">ไม่พบลูกค้า — กรุณาเพิ่มที่ ตั้งค่า → ลูกค้า</p>
                        ) : filteredCustomers.map(c => (
                          <button key={c.customer_id} onClick={() => { setManualCustomerId(c.customer_id); setShowCustomerPicker(false); setCustomerSearch(''); }}
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
                {gateInBillingData.charges.map((ch, i) => (
                  <div key={`gi-t-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!gateInSelectedCharges.has(i) ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={gateInSelectedCharges.has(i)}
                      onChange={() => {
                        setGateInSelectedCharges(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-200">{ch.description}</p>
                      <p className="text-[10px] text-slate-400">{ch.quantity} × ฿{ch.unit_price.toLocaleString()}</p>
                    </div>
                    <input type="number" value={i in gateInChargeOverrides ? gateInChargeOverrides[i] : ch.subtotal}
                      onChange={(e) => setGateInChargeOverrides(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                      className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                ))}

                {/* Custom charges */}
                {gateInCustomCharges.map((ch, i) => (
                  <div key={`gi-c-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!gateInSelectedCustom.has(i) ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={gateInSelectedCustom.has(i)}
                      onChange={() => {
                        setGateInSelectedCustom(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div className="flex-1">
                      <input type="text" value={ch.description}
                        onChange={(e) => { const arr = [...gateInCustomCharges]; arr[i] = { ...arr[i], description: e.target.value }; setGateInCustomCharges(arr); }}
                        className="w-full h-7 px-2 text-sm rounded border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                        placeholder="ชื่อรายการ" />
                    </div>
                    <input type="number" value={ch.subtotal}
                      onChange={(e) => { const arr = [...gateInCustomCharges]; const val = parseFloat(e.target.value) || 0; arr[i] = { ...arr[i], subtotal: val, unit_price: val }; setGateInCustomCharges(arr); }}
                      className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                    <button onClick={() => {
                      setGateInCustomCharges(prev => prev.filter((_, j) => j !== i));
                      setGateInSelectedCustom(prev => { const next = new Set<number>(); prev.forEach(v => { if (v < i) next.add(v); else if (v > i) next.add(v - 1); }); return next; });
                    }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>

              {/* Add custom charge */}
              <div className="px-4 py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                <button onClick={() => {
                  const newCharge: BillingCharge = { charge_type: 'custom', description: '', quantity: 1, unit_price: 0, subtotal: 0, free_days: 0, billable_days: 0 };
                  setGateInCustomCharges(prev => [...prev, newCharge]);
                  setGateInSelectedCustom(prev => new Set([...prev, gateInCustomCharges.length]));
                }} className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-colors flex items-center justify-center gap-1"
                >+ เพิ่มรายการค่าบริการ</button>
              </div>

              {/* Summary */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>รวมก่อน VAT ({gateInSelectedCharges.size}/{gateInBillingData.charges.length} รายการ)</span>
                  <span>฿{gateInSelectedTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>VAT 7%</span>
                  <span>฿{gateInSelectedVat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-600">
                  <span>ยอดรวมทั้งสิ้น</span>
                  <span className="text-emerald-600">฿{gateInSelectedGrand.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Action */}
              {!gateInBillingPaid && (
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
                        <p className="text-[10px] text-blue-500">สร้างใบแจ้งหนี้ (pending) → รับตู้ได้เลย</p>
                      </div>
                      <button disabled={gateInPayLoading || !canCreateInvoice} onClick={async () => {
                        if (!resolvedCustomer) return;
                        setGateInPayLoading(true);
                        try {
                          const creditTerm = resolvedCustomer.credit_term || 0;
                          const res = await fetch('/api/billing/invoices', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              yard_id: yardId, customer_id: resolvedCustomer.customer_id,
                              charge_type: 'gate_in', description: `ค่าบริการ Gate-In ${gateInForm.container_number}`,
                              quantity: 1, unit_price: gateInSelectedTotal,
                              due_date: new Date(Date.now() + creditTerm * 86400000).toISOString(),
                              notes: JSON.stringify({
                                charges: buildGateInFinalCharges(),
                                transaction_type: 'gate_in',
                                container_number: gateInForm.container_number,
                                payment_method: 'credit',
                                payment_status: 'credit',
                                document_type: 'invoice',
                              }),
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            await createGateInClearance('credit', data.invoice?.invoice_id || null, 'ลูกค้าเครดิต');
                            setGateInBillingPaid(true);
                            setGateInInvoiceNumber(data.invoice_number || '');
                            setGateInInvoiceId(data.invoice?.invoice_id || null);
                          }
                        } catch (err) { console.error(err); }
                        finally { setGateInPayLoading(false); }
                      }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                        {gateInPayLoading ? <Loader2 size={12} className="animate-spin" /> : null} 📄 วางบิล
                      </button>
                    </div>
                  ) : (
                    <>
                      {gateInSelectedGrand <= 0 && (
                        <button disabled={gateInPayLoading || !resolvedCustomer || !canWaive} onClick={handleGateInNoChargeOrWaive}
                          className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                          {gateInPayLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          {gateInOriginalSelectedTotal > 0 ? 'อนุมัติยกเว้นค่าใช้จ่าย' : 'ยืนยัน No Charge ฿0'}
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">วิธีชำระ:</span>
                        {(['cash', 'transfer'] as const).map(m => (
                          <button key={m} onClick={() => setGateInPaymentMethod(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              gateInPaymentMethod === m ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                            }`}>
                            {m === 'cash' ? '💵 เงินสด' : '💳 โอน'}
                          </button>
                        ))}
                      </div>
                      <button disabled={gateInPayLoading || gateInSelectedGrand <= 0 || !resolvedCustomer || !canReceivePayment} onClick={async () => {
                        if (!resolvedCustomer) return;
                        setGateInPayLoading(true);
                        try {
                          const custId = resolvedCustomer.customer_id;
                          const res = await fetch('/api/billing/invoices', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              yard_id: yardId, customer_id: custId,
                              charge_type: 'gate_in', description: `ค่าบริการ Gate-In ${gateInForm.container_number} — ชำระ${gateInPaymentMethod === 'cash' ? 'เงินสด' : 'โอน'}`,
                              quantity: 1, unit_price: gateInSelectedTotal,
                              notes: JSON.stringify({
                                charges: buildGateInFinalCharges(),
                                transaction_type: 'gate_in',
                                container_number: gateInForm.container_number,
                                payment_method: gateInPaymentMethod,
                                payment_status: 'paid',
                                document_type: 'receipt',
                              }),
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            if (data.invoice?.invoice_id) {
                              await fetch('/api/billing/invoices', {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invoice_id: data.invoice.invoice_id, action: 'pay' }),
                              });
                            }
                            await createGateInClearance('paid', data.invoice?.invoice_id || null, gateInPaymentMethod === 'cash' ? 'ชำระเงินสด' : 'ชำระเงินโอน');
                            setGateInBillingPaid(true);
                            setGateInInvoiceNumber(data.invoice_number || '');
                            setGateInInvoiceId(data.invoice?.invoice_id || null);
                          }
                        } catch (err) { console.error(err); }
                        finally { setGateInPayLoading(false); }
                      }} className="w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {gateInPayLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                        💰 ชำระเงิน ฿{gateInSelectedGrand.toLocaleString()}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Paid confirmation */}
              {gateInBillingPaid && (
                <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-bold">✅ {
                      gateInClearance?.clearance_type === 'no_charge' ? 'No Charge' :
                      gateInClearance?.clearance_type === 'waived' ? 'Waived' :
                      resolvedIsCredit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'
                    }</span>
                    {gateInInvoiceNumber && <span className="text-xs font-mono text-emerald-500">({gateInInvoiceNumber})</span>}
                  </div>
                </div>
              )}
            </div>
          ) : gateInBillingData && gateInBillingData.charges.length === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> ไม่มีค่าบริการ Gate-In</span>
              {!gateInBillingCleared && (
                <button onClick={() => createGateInClearance('no_charge', null, 'ไม่มีค่าบริการ Gate-In')}
                  disabled={!canWaive}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  ยืนยัน No Charge
                </button>
              )}
            </div>
          ) : null}

          {(gateInBillingData || gateInBillingCleared) && (
            <GateInDocumentActionStrip
              billingCleared={gateInBillingCleared}
              invoiceId={gateInInvoiceId}
              invoiceNumber={gateInInvoiceNumber}
              receiptPrintOpened={gateInReceiptPrintOpened}
              readyForEir={gateInEirStepActive}
              eirIssued={gateInEirIssued}
              clearanceLabel={gateInClearanceLabel}
              onPrintA4={() => openGateInBillingPrint({ templateFamily: 'a4_tax_receipt' })}
              onPrintContinuous={() => openGateInBillingPrint({ templateFamily: 'continuous_tax_receipt' })}
            />
          )}

          <GateInSubmitSection
            gateInForm={gateInForm}
            setGateInForm={setGateInForm}
            gateInLoading={gateInLoading}
            canGateIn={canGateIn}
            containerValid={containerValid}
            gateInRequiresBillingClearance={gateInRequiresBillingClearance}
            gateInBillingCleared={gateInBillingCleared}
            gateInResult={gateInResult}
            setGateInResult={setGateInResult}
            handleGateIn={handleGateIn}
            onViewEIR={onViewEIR}
          />
            </div>

            <aside className="gate-in-side-rail space-y-3 xl:sticky xl:top-20 xl:self-start">
              <GateDecisionBar signals={gateInDecisionSignals} compact />
              {gateInGuardrails.alerts.length > 0 && (
                <GateGuardrailPanel title="Gate-In checks" snapshot={gateInGuardrails} compact />
              )}
              <GateInVisibilityPreviewPanel
                rows={visibilityPreview}
                loading={visibilityPreviewLoading}
                error={visibilityPreviewError}
              />
            </aside>
          </div>
        </div>
      </div>

      {showOCR && (
        <CameraOCR
          label={showOCR === 'container' ? 'สแกนเลขตู้' : showOCR === 'plate' ? 'สแกนทะเบียนรถ' : 'สแกนเลขซีล'}
          mode={showOCR === 'container' ? 'container' : showOCR === 'plate' ? 'plate' : 'seal'}
          onResult={handleOCRResult}
          onClose={() => setShowOCR(null)}
        />
      )}
      <ActionInputDialog
        open={gateInWaiveDialogOpen}
        title="ยกเว้นค่าใช้จ่าย Gate-In"
        description="ระบุเหตุผลเพื่อเก็บใน billing clearance และ audit trail"
        fields={[{ name: 'reason', label: 'เหตุผล', type: 'textarea', required: true }]}
        confirmLabel="ยืนยันยกเว้น"
        loading={gateInPayLoading}
        onCancel={() => setGateInWaiveDialogOpen(false)}
        onSubmit={({ reason }) => {
          const trimmed = reason.trim();
          if (!trimmed) return;
          void submitGateInWaiver(trimmed);
        }}
      />

      {/* === HALT RULE POPUP: Multi-customer prefix conflict === */}
      {showHaltPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-amber-500" size={24} />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">&#x26A0;&#xFE0F; เลือกเจ้าของตู้</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Prefix <span className="font-mono font-bold">{gateInForm.container_number.substring(0, 4).toUpperCase()}</span> ผูกกับลูกค้าหลายราย กรุณาเลือกว่างานนี้เป็นของใคร
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {haltCandidates.map(c => (
                <button key={c.customer_id}
                  onClick={() => {
                    setContainerOwnerId(c.customer_id);
                    setOwnerSearch(c.customer_name);
                    if (!billingDiffFromOwner) setBillingCustomerId(c.customer_id);
                    setManualCustomerId(c.customer_id);
                    setShowHaltPopup(false);
                    setBoxtechResult(prev => prev ? { ...prev, customer: { customer_id: c.customer_id, customer_name: c.customer_name, credit_term: c.credit_term }, multiple_customers: false } : null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                    c.is_primary ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-600'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-slate-800 dark:text-white">{c.customer_name}</span>
                    {c.is_primary && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">&#x2B50; แนะนำ</span>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {c.is_line && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">สายเรือ</span>}
                    {c.is_forwarder && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">ตัวแทน</span>}
                    {c.is_trucking && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">รถบรรทุก</span>}
                    {c.credit_term > 0 && <span className="text-xs text-slate-500">Credit {c.credit_term} วัน</span>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
              <AlertTriangle size={12} /> ต้องเลือกลูกค้าก่อนดำเนินการ Gate-In (ป้องกันวางบิลผิดคน)
            </p>
          </div>
        </div>
      )}
    </>
  );
}

