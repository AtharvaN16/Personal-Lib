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
      book_lookup_cache: {
        Row: {
          isbn: string
          title: string
          authors: string[]
          publisher: string | null
          published_date: string | null
          description: string | null
          cover_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          isbn: string
          title: string
          authors?: string[]
          publisher?: string | null
          published_date?: string | null
          description?: string | null
          cover_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          isbn?: string
          title?: string
          authors?: string[]
          publisher?: string | null
          published_date?: string | null
          description?: string | null
          cover_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      book_lookup_daily_usage: {
        Row: {
          user_id: string
          lookup_date: string
          lookup_count: number
          updated_at: string
        }
        Insert: {
          user_id: string
          lookup_date: string
          lookup_count?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          lookup_date?: string
          lookup_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_lookup_daily_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          user_id: string
          theme_color: string
          default_location_id: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          theme_color?: string
          default_location_id?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          theme_color?: string
          default_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_book_lookup_quota: {
        Args: {
          p_lookup_date: string
          p_max_lookups: number
        }
        Returns: {
          allowed: boolean
          lookup_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
