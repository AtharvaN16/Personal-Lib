export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shelves: {
        Row: {
          id: string
          user_id: string
          room: string
          bookshelf: string
          shelf_index: number | null
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room: string
          bookshelf: string
          shelf_index?: number | null
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          room?: string
          bookshelf?: string
          shelf_index?: number | null
          name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      books: {
        Row: {
          id: string
          user_id: string
          isbn: string | null
          title: string
          authors: string[]
          publisher: string | null
          published_date: string | null
          description: string | null
          cover_url: string | null
          location_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          isbn?: string | null
          title: string
          authors?: string[]
          publisher?: string | null
          published_date?: string | null
          description?: string | null
          cover_url?: string | null
          location_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          isbn?: string | null
          title?: string
          authors?: string[]
          publisher?: string | null
          published_date?: string | null
          description?: string | null
          cover_url?: string | null
          location_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
