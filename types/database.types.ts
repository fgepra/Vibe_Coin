export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          balance: number;
          total_profit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          balance?: number;
          total_profit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          balance?: number;
          total_profit?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      coins: {
        Row: {
          id: string;
          symbol: string;
          name: string;
          current_price: number;
          price_change_24h: number;
          price_change_percent_24h: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          name: string;
          current_price: number;
          price_change_24h?: number;
          price_change_percent_24h?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          symbol?: string;
          name?: string;
          current_price?: number;
          price_change_24h?: number;
          price_change_percent_24h?: number;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          coin_id: string;
          type: "buy" | "sell";
          quantity: number;
          price: number;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          coin_id: string;
          type: "buy" | "sell";
          quantity: number;
          price: number;
          total_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          coin_id?: string;
          type?: "buy" | "sell";
          quantity?: number;
          price?: number;
          total_amount?: number;
          created_at?: string;
        };
      };
      holdings: {
        Row: {
          id: string;
          user_id: string;
          coin_id: string;
          quantity: number;
          average_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          coin_id: string;
          quantity: number;
          average_price: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          coin_id?: string;
          quantity?: number;
          average_price?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      transaction_type: "buy" | "sell";
    };
  };
}

