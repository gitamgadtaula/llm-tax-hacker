export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface Receipt {
  id: number;
  user_id: number;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  uploaded_at: Date;
}

export interface Transaction {
  name: string;
  amount: number;
}

export interface ReceiptAnalysis {
  id?: number;
  receipt_id?: number;
  name: string;
  merchant: string;
  description: string;
  type: "expense" | "income" | "pending" | "other";
  issued_at: string;
  category: string;
  location?: string;
  note?: string;
  contact?: string;
  transactions: Transaction[];
  tax?: number;
  vat?: number;
  other_charges?: number;
  total: number;
  raw_llm_response?: any;
  created_at?: Date;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    email: string;
  };
}
