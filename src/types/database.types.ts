export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          born_date: string | null
          created_at: string | null
          id: number
          name: string
          nationality: string | null
        }
        Insert: {
          bio?: string | null
          born_date?: string | null
          created_at?: string | null
          id?: number
          name: string
          nationality?: string | null
        }
        Update: {
          bio?: string | null
          born_date?: string | null
          created_at?: string | null
          id?: number
          name?: string
          nationality?: string | null
        }
        Relationships: []
      }
      book_authors: {
        Row: {
          author_id: number
          book_id: number
        }
        Insert: {
          author_id: number
          book_id: number
        }
        Update: {
          author_id?: number
          book_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_copies: {
        Row: {
          acquired_at: string | null
          book_id: number | null
          copy_id: number
          status: string | null
        }
        Insert: {
          acquired_at?: string | null
          book_id?: number | null
          copy_id?: number
          status?: string | null
        }
        Update: {
          acquired_at?: string | null
          book_id?: number | null
          copy_id?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_genres: {
        Row: {
          book_id: number
          genre_id: number
        }
        Insert: {
          book_id: number
          genre_id: number
        }
        Update: {
          book_id?: number
          genre_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_genres_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_genres_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_genres_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "book_genres_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          avg_rating: number | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          format: string | null
          id: number
          isbn: string | null
          language: string | null
          published_date: string | null
          publisher_id: number | null
          review_count: number | null
          search_vector: unknown
          title: string
        }
        Insert: {
          avg_rating?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          format?: string | null
          id?: number
          isbn?: string | null
          language?: string | null
          published_date?: string | null
          publisher_id?: number | null
          review_count?: number | null
          search_vector?: unknown
          title: string
        }
        Update: {
          avg_rating?: number | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          format?: string | null
          id?: number
          isbn?: string | null
          language?: string | null
          published_date?: string | null
          publisher_id?: number | null
          review_count?: number | null
          search_vector?: unknown
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      borrow_history: {
        Row: {
          book_id: number | null
          borrowed_at: string | null
          copy_id: number | null
          due_date: string | null
          fine_amount: number | null
          fine_status: string | null
          id: number
          returned_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: number | null
          borrowed_at?: string | null
          copy_id?: number | null
          due_date?: string | null
          fine_amount?: number | null
          fine_status?: string | null
          id?: number
          returned_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: number | null
          borrowed_at?: string | null
          copy_id?: number | null
          due_date?: string | null
          fine_amount?: number | null
          fine_status?: string | null
          id?: number
          returned_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrow_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "borrow_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_history_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "book_copies"
            referencedColumns: ["copy_id"]
          },
          {
            foreignKeyName: "borrow_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      membership_tiers: {
        Row: {
          created_at: string | null
          daily_fine_rate: number
          description: string | null
          id: number
          max_borrows: number
          name: string
        }
        Insert: {
          created_at?: string | null
          daily_fine_rate?: number
          description?: string | null
          id?: number
          max_borrows?: number
          name: string
        }
        Update: {
          created_at?: string | null
          daily_fine_rate?: number
          description?: string | null
          id?: number
          max_borrows?: number
          name?: string
        }
        Relationships: []
      }
      publishers: {
        Row: {
          address: string | null
          created_at: string | null
          id: number
          name: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: number
          name: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: number
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          book_id: number | null
          created_at: string | null
          id: number
          rating: number
          user_id: string | null
        }
        Insert: {
          body?: string | null
          book_id?: number | null
          created_at?: string | null
          id?: number
          rating: number
          user_id?: string | null
        }
        Update: {
          body?: string | null
          book_id?: number | null
          created_at?: string | null
          id?: number
          rating?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          followed_at: string | null
          followed_id: string
          follower_id: string
        }
        Insert: {
          followed_at?: string | null
          followed_id: string
          follower_id: string
        }
        Update: {
          followed_at?: string | null
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          preferences: Json | null
          role: string | null
          tier_id: number | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          preferences?: Json | null
          role?: string | null
          tier_id?: number | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          preferences?: Json | null
          role?: string | null
          tier_id?: number | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          book_id: number | null
          id: number
          joined_at: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: number | null
          id?: number
          joined_at?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: number | null
          id?: number
          joined_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "pending_requests"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "trending_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      book_details: {
        Row: {
          authors: string[] | null
          available_copies: number | null
          avg_rating: number | null
          cover_url: string | null
          description: string | null
          format: string | null
          genres: string[] | null
          id: number | null
          isbn: string | null
          language: string | null
          published_date: string | null
          publisher_name: string | null
          review_count: number | null
          searchable_text: string | null
          title: string | null
          total_copies: number | null
          waitlist_count: number | null
        }
        Relationships: []
      }
      genre_stats: {
        Row: {
          avg_rating: number | null
          book_count: number | null
          name: string | null
        }
        Relationships: []
      }
      overdue_borrows: {
        Row: {
          due_date: string | null
          email: string | null
          overdue_by: string | null
          title: string | null
          username: string | null
        }
        Relationships: []
      }
      pending_requests: {
        Row: {
          book_id: number | null
          borrow_id: number | null
          email: string | null
          requested_at: string | null
          title: string | null
          username: string | null
        }
        Relationships: []
      }
      trending_books: {
        Row: {
          avg_rating: number | null
          borrows_this_week: number | null
          cover_url: string | null
          id: number | null
          title: string | null
        }
        Relationships: []
      }
      user_reading_history: {
        Row: {
          borrowed_at: string | null
          cover_url: string | null
          due_date: string | null
          returned_at: string | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrow_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_request: {
        Args: { p_borrow_id: number; p_user_id: string }
        Returns: string
      }
      confirm_borrow: { Args: { p_borrow_id: number }; Returns: string }
      leave_waitlist: {
        Args: { p_book_id: number; p_user_id: string }
        Returns: string
      }
      mark_overdue: { Args: never; Returns: number }
      reject_borrow: {
        Args: { p_borrow_id: number; p_reason?: string }
        Returns: string
      }
      request_borrow: {
        Args: { p_book_id: number; p_user_id: string }
        Returns: string
      }
      return_book: {
        Args: { p_book_id: number; p_user_id: string }
        Returns: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
