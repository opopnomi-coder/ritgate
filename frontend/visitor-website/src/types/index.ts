export interface Department {
  id: number;
  name: string;
}

export interface Staff {
  id: string;
  staffId: string;
  staffCode: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  department: string;
}

export interface VisitorRegistration {
  name: string;
  email: string;
  phone: string;
  type: 'VISITOR' | 'VENDOR';
  role?: 'VISITOR' | 'VENDOR';
  department?: string;
  purpose: string;
  numberOfPeople?: number;
  vehicleNumber?: string;
  personToMeet?: string;
  staffCode?: string;
}

export interface VisitorResponse {
  id: number;
  name: string;
  email: string;
  department: string;
  personToMeet: string;
  approvalStatus: string;
  message?: string;
}
