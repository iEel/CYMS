export interface TransportCapabilities {
  transport?: {
    enabled: boolean;
    mode: 'driver' | 'trucking';
  };
}

export type TransportAction = 'confirm_job' | 'mark_arrived' | 'report_issue' | 'add_proof';

export interface TransportJobActivity {
  activityId: number;
  action: TransportAction;
  previousStatus?: string | null;
  newStatus?: string | null;
  note?: string | null;
  proofUrl?: string | null;
  actorMode: 'driver' | 'trucking';
  createdAt?: string;
}

export interface TransportJobProof {
  proofId: number;
  proofType: 'pickup' | 'arrival' | 'seal' | 'other';
  fileUrl: string;
  note?: string | null;
  createdAt?: string;
}

export interface TransportJob {
  jobId: string;
  source: 'gate_out_request' | 'gate_transaction';
  status: string;
  availableActions: TransportAction[];
  proofCount: number;
  lastActivityAt?: string;
  containerNumber: string;
  bookingNumber?: string;
  transactionType?: string;
  yardName?: string;
  yardSlot?: string;
  requestedAt?: string;
  gateDatetime?: string;
  driverName?: string;
  truckPlate?: string;
  eirNumber?: string;
  attentionReason?: string;
}

export interface TransportJobsResponse {
  summary: {
    open: number;
    atGate: number;
    releasedToday: number;
    attention: number;
  };
  jobs: TransportJob[];
}
