export interface TransportCapabilities {
  transport?: {
    enabled: boolean;
    mode: 'driver' | 'trucking';
  };
}

export interface TransportJob {
  jobId: string;
  source: 'gate_out_request' | 'gate_transaction';
  status: string;
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
