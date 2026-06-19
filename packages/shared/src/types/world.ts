export interface SubnetConfig {
  zoneId: string;
  zoneName: string;
  subnetId: string;
  prefix: string;
  machineCount: number;
  landmarkCount: number;
  theme: string;
}

export interface ScanRequest {
  id: string;
  accountId: string;
  subnetId: string;
  status: 'queued' | 'complete';
  results?: string[];
  queuedAt: string;
  completedAt?: string;
}

export interface WorldSubnetResponse {
  subnet: SubnetConfig;
  heatLevel: number;
}
