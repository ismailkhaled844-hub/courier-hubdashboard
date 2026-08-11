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
      capacity_edits: {
        Row: {
          cell_key: string
          updated_at: string
          value: number
        }
        Insert: {
          cell_key: string
          updated_at?: string
          value: number
        }
        Update: {
          cell_key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      manpower: {
        Row: {
          account_bank: string
          cap: string
          contracts: string
          courier_name: string
          created_at: string
          doc_birth: boolean
          doc_criminal: boolean
          doc_form1: boolean
          doc_graduation: boolean
          doc_insurance_print: boolean
          doc_military: boolean
          doc_photos: boolean
          email_subject: string | null
          email_subject_contracts: string | null
          email_subject_missing: string | null
          email_subject_renewal: string | null
          employment_type: string
          gmail: string
          id: string
          id_number: string
          insurance_no: string
          ka3b3aml: string
          leaver_reason: string
          leaver_type: string
          leaving_date: string
          medical_card: string
          mobile: string
          mobile_line: string
          mobile_personal: string
          region: string
          starting_date: string
          status: string
          system: string
          title: string
          updated_at: string
        }
        Insert: {
          account_bank?: string
          cap?: string
          contracts?: string
          courier_name?: string
          created_at?: string
          doc_birth?: boolean
          doc_criminal?: boolean
          doc_form1?: boolean
          doc_graduation?: boolean
          doc_insurance_print?: boolean
          doc_military?: boolean
          doc_photos?: boolean
          email_subject?: string | null
          email_subject_contracts?: string | null
          email_subject_missing?: string | null
          email_subject_renewal?: string | null
          employment_type?: string
          gmail?: string
          id?: string
          id_number?: string
          insurance_no?: string
          ka3b3aml?: string
          leaver_reason?: string
          leaver_type?: string
          leaving_date?: string
          medical_card?: string
          mobile?: string
          mobile_line?: string
          mobile_personal?: string
          region?: string
          starting_date?: string
          status?: string
          system?: string
          title?: string
          updated_at?: string
        }
        Update: {
          account_bank?: string
          cap?: string
          contracts?: string
          courier_name?: string
          created_at?: string
          doc_birth?: boolean
          doc_criminal?: boolean
          doc_form1?: boolean
          doc_graduation?: boolean
          doc_insurance_print?: boolean
          doc_military?: boolean
          doc_photos?: boolean
          email_subject?: string | null
          email_subject_contracts?: string | null
          email_subject_missing?: string | null
          email_subject_renewal?: string | null
          employment_type?: string
          gmail?: string
          id?: string
          id_number?: string
          insurance_no?: string
          ka3b3aml?: string
          leaver_reason?: string
          leaver_type?: string
          leaving_date?: string
          medical_card?: string
          mobile?: string
          mobile_line?: string
          mobile_personal?: string
          region?: string
          starting_date?: string
          status?: string
          system?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      manpower_regions: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      oms_employees: {
        Row: {
          created_at: string
          gender: string
          hiring_date: string
          id: string
          insur_comp: string
          maxer_id: string
          mobile_number: string
          name_ar: string
          name_en: string
          national_id: string
          partner_id: string
          site: string
          structure_company: string
          sys_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender?: string
          hiring_date?: string
          id?: string
          insur_comp?: string
          maxer_id?: string
          mobile_number?: string
          name_ar?: string
          name_en?: string
          national_id?: string
          partner_id?: string
          site?: string
          structure_company?: string
          sys_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: string
          hiring_date?: string
          id?: string
          insur_comp?: string
          maxer_id?: string
          mobile_number?: string
          name_ar?: string
          name_en?: string
          national_id?: string
          partner_id?: string
          site?: string
          structure_company?: string
          sys_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      oms_payroll: {
        Row: {
          absence: string | null
          account_number: string | null
          attendance_lateness: string | null
          cash_deficit: string | null
          ceiling_variable_salary: string | null
          comments: string | null
          cost_centre: string | null
          damage_deficit: string | null
          deductions_0005: string | null
          department: string | null
          fixed_allowances: string | null
          fixed_allowances_per_working_day: string | null
          id: string
          leaving_date: string | null
          m: string | null
          national_id: string
          net_bonus: string | null
          net_fixed_per_working_days: string | null
          net_fixed_salary: string | null
          net_variable_salary: string | null
          other_deductions: string | null
          overtime_per_days: string | null
          overtime_per_hours: string | null
          payment_method: string | null
          pending_deficit: string | null
          productivity_bonus: string | null
          sub_department: string | null
          title: string | null
          total_deduction: string | null
          total_earning: string | null
          total_net: string | null
          transportation: string | null
          uploaded_at: string
          working_days: string | null
        }
        Insert: {
          absence?: string | null
          account_number?: string | null
          attendance_lateness?: string | null
          cash_deficit?: string | null
          ceiling_variable_salary?: string | null
          comments?: string | null
          cost_centre?: string | null
          damage_deficit?: string | null
          deductions_0005?: string | null
          department?: string | null
          fixed_allowances?: string | null
          fixed_allowances_per_working_day?: string | null
          id?: string
          leaving_date?: string | null
          m?: string | null
          national_id: string
          net_bonus?: string | null
          net_fixed_per_working_days?: string | null
          net_fixed_salary?: string | null
          net_variable_salary?: string | null
          other_deductions?: string | null
          overtime_per_days?: string | null
          overtime_per_hours?: string | null
          payment_method?: string | null
          pending_deficit?: string | null
          productivity_bonus?: string | null
          sub_department?: string | null
          title?: string | null
          total_deduction?: string | null
          total_earning?: string | null
          total_net?: string | null
          transportation?: string | null
          uploaded_at?: string
          working_days?: string | null
        }
        Update: {
          absence?: string | null
          account_number?: string | null
          attendance_lateness?: string | null
          cash_deficit?: string | null
          ceiling_variable_salary?: string | null
          comments?: string | null
          cost_centre?: string | null
          damage_deficit?: string | null
          deductions_0005?: string | null
          department?: string | null
          fixed_allowances?: string | null
          fixed_allowances_per_working_day?: string | null
          id?: string
          leaving_date?: string | null
          m?: string | null
          national_id?: string
          net_bonus?: string | null
          net_fixed_per_working_days?: string | null
          net_fixed_salary?: string | null
          net_variable_salary?: string | null
          other_deductions?: string | null
          overtime_per_days?: string | null
          overtime_per_hours?: string | null
          payment_method?: string | null
          pending_deficit?: string | null
          productivity_bonus?: string | null
          sub_department?: string | null
          title?: string | null
          total_deduction?: string | null
          total_earning?: string | null
          total_net?: string | null
          transportation?: string | null
          uploaded_at?: string
          working_days?: string | null
        }
        Relationships: []
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
