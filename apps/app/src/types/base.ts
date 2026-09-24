export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      animateurs: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          nom: string
          role: Database["public"]["Enums"]["role_animateur"]
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id: string
          nom: string
          role?: Database["public"]["Enums"]["role_animateur"]
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          nom?: string
          role?: Database["public"]["Enums"]["role_animateur"]
        }
        Relationships: []
      }
      contenus: {
        Row: {
          actif: boolean
          cree_le: string
          cree_par: string | null
          etiquette: Database["public"]["Enums"]["etiquette"]
          id: string
          jeu: Database["public"]["Enums"]["jeu"]
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          cree_par?: string | null
          etiquette?: Database["public"]["Enums"]["etiquette"]
          id?: string
          jeu: Database["public"]["Enums"]["jeu"]
        }
        Update: {
          actif?: boolean
          cree_le?: string
          cree_par?: string | null
          etiquette?: Database["public"]["Enums"]["etiquette"]
          id?: string
          jeu?: Database["public"]["Enums"]["jeu"]
        }
        Relationships: [
          {
            foreignKeyName: "contenus_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "animateurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contenus_jeu_fkey"
            columns: ["jeu"]
            isOneToOne: false
            referencedRelation: "jeux"
            referencedColumns: ["code"]
          },
        ]
      }
      contenus_secrets: {
        Row: {
          contenu_id: string
          langue: Database["public"]["Enums"]["langue"]
          valeur: Json
        }
        Insert: {
          contenu_id: string
          langue: Database["public"]["Enums"]["langue"]
          valeur: Json
        }
        Update: {
          contenu_id?: string
          langue?: Database["public"]["Enums"]["langue"]
          valeur?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contenus_secrets_contenu_id_fkey"
            columns: ["contenu_id"]
            isOneToOne: false
            referencedRelation: "contenus"
            referencedColumns: ["id"]
          },
        ]
      }
      contenus_traductions: {
        Row: {
          contenu_id: string
          langue: Database["public"]["Enums"]["langue"]
          valeur: Json
        }
        Insert: {
          contenu_id: string
          langue: Database["public"]["Enums"]["langue"]
          valeur?: Json
        }
        Update: {
          contenu_id?: string
          langue?: Database["public"]["Enums"]["langue"]
          valeur?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contenus_traductions_contenu_id_fkey"
            columns: ["contenu_id"]
            isOneToOne: false
            referencedRelation: "contenus"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          cree_le: string
          evenement_id: string
          id: string
          nom: string
          numero: number
        }
        Insert: {
          cree_le?: string
          evenement_id: string
          id?: string
          nom: string
          numero: number
        }
        Update: {
          cree_le?: string
          evenement_id?: string
          id?: string
          nom?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipes_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements: {
        Row: {
          animateur_id: string
          client_nom: string
          code: string
          code_expire_le: string | null
          commence_le: string | null
          cree_le: string
          creneau_minutes: number
          date_evenement: string
          id: string
          langues: Database["public"]["Enums"]["langue"][]
          lieu: string | null
          occasion: string | null
          photos_closes_le: string | null
          statut: Database["public"]["Enums"]["statut_evenement"]
          termine_le: string | null
          type_client: Database["public"]["Enums"]["type_client"]
        }
        Insert: {
          animateur_id: string
          client_nom: string
          code?: string
          code_expire_le?: string | null
          commence_le?: string | null
          cree_le?: string
          creneau_minutes: number
          date_evenement: string
          id?: string
          langues?: Database["public"]["Enums"]["langue"][]
          lieu?: string | null
          occasion?: string | null
          photos_closes_le?: string | null
          statut?: Database["public"]["Enums"]["statut_evenement"]
          termine_le?: string | null
          type_client?: Database["public"]["Enums"]["type_client"]
        }
        Update: {
          animateur_id?: string
          client_nom?: string
          code?: string
          code_expire_le?: string | null
          commence_le?: string | null
          cree_le?: string
          creneau_minutes?: number
          date_evenement?: string
          id?: string
          langues?: Database["public"]["Enums"]["langue"][]
          lieu?: string | null
          occasion?: string | null
          photos_closes_le?: string | null
          statut?: Database["public"]["Enums"]["statut_evenement"]
          termine_le?: string | null
          type_client?: Database["public"]["Enums"]["type_client"]
        }
        Relationships: [
          {
            foreignKeyName: "evenements_animateur_id_fkey"
            columns: ["animateur_id"]
            isOneToOne: false
            referencedRelation: "animateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      jeux: {
        Row: {
          beta: boolean
          chrono_passage_s: number | null
          code: Database["public"]["Enums"]["jeu"]
          nom: string
          ordre_affichage: number
          sequentiel: boolean
        }
        Insert: {
          beta?: boolean
          chrono_passage_s?: number | null
          code: Database["public"]["Enums"]["jeu"]
          nom: string
          ordre_affichage: number
          sequentiel: boolean
        }
        Update: {
          beta?: boolean
          chrono_passage_s?: number | null
          code?: Database["public"]["Enums"]["jeu"]
          nom?: string
          ordre_affichage?: number
          sequentiel?: boolean
        }
        Relationships: []
      }
      joueurs: {
        Row: {
          capitaine: boolean
          equipe_id: string | null
          evenement_id: string
          id: string
          jeton_hash: string
          langue: Database["public"]["Enums"]["langue"]
          prenom: string
          rejoint_le: string
          vu_le: string
        }
        Insert: {
          capitaine?: boolean
          equipe_id?: string | null
          evenement_id: string
          id?: string
          jeton_hash: string
          langue?: Database["public"]["Enums"]["langue"]
          prenom: string
          rejoint_le?: string
          vu_le?: string
        }
        Update: {
          capitaine?: boolean
          equipe_id?: string | null
          evenement_id?: string
          id?: string
          jeton_hash?: string
          langue?: Database["public"]["Enums"]["langue"]
          prenom?: string
          rejoint_le?: string
          vu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "joueurs_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "classement"
            referencedColumns: ["equipe_id", "evenement_id"]
          },
          {
            foreignKeyName: "joueurs_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "joueurs_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
        ]
      }
      manches: {
        Row: {
          commence_le: string | null
          cree_le: string
          evenement_id: string
          id: string
          jeu: Database["public"]["Enums"]["jeu"]
          options: Json
          ordre: number
          statut: Database["public"]["Enums"]["statut_manche"]
          termine_le: string | null
        }
        Insert: {
          commence_le?: string | null
          cree_le?: string
          evenement_id: string
          id?: string
          jeu: Database["public"]["Enums"]["jeu"]
          options?: Json
          ordre: number
          statut?: Database["public"]["Enums"]["statut_manche"]
          termine_le?: string | null
        }
        Update: {
          commence_le?: string | null
          cree_le?: string
          evenement_id?: string
          id?: string
          jeu?: Database["public"]["Enums"]["jeu"]
          options?: Json
          ordre?: number
          statut?: Database["public"]["Enums"]["statut_manche"]
          termine_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manches_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manches_jeu_fkey"
            columns: ["jeu"]
            isOneToOne: false
            referencedRelation: "jeux"
            referencedColumns: ["code"]
          },
        ]
      }
      passages: {
        Row: {
          commence_le: string | null
          contenu_id: string | null
          equipe_id: string | null
          evenement_id: string
          id: string
          joueur_designe_id: string | null
          manche_id: string
          ordre: number
          points: number | null
          resultat: Json
          statut: Database["public"]["Enums"]["statut_passage"]
          termine_le: string | null
        }
        Insert: {
          commence_le?: string | null
          contenu_id?: string | null
          equipe_id?: string | null
          evenement_id: string
          id?: string
          joueur_designe_id?: string | null
          manche_id: string
          ordre: number
          points?: number | null
          resultat?: Json
          statut?: Database["public"]["Enums"]["statut_passage"]
          termine_le?: string | null
        }
        Update: {
          commence_le?: string | null
          contenu_id?: string | null
          equipe_id?: string | null
          evenement_id?: string
          id?: string
          joueur_designe_id?: string | null
          manche_id?: string
          ordre?: number
          points?: number | null
          resultat?: Json
          statut?: Database["public"]["Enums"]["statut_passage"]
          termine_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passages_contenu_id_fkey"
            columns: ["contenu_id"]
            isOneToOne: false
            referencedRelation: "contenus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passages_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "classement"
            referencedColumns: ["equipe_id", "evenement_id"]
          },
          {
            foreignKeyName: "passages_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "passages_joueur_designe_id_fkey"
            columns: ["joueur_designe_id"]
            isOneToOne: false
            referencedRelation: "joueurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passages_manche_id_evenement_id_fkey"
            columns: ["manche_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "manches"
            referencedColumns: ["id", "evenement_id"]
          },
        ]
      }
      photos: {
        Row: {
          chemin: string
          envoyee_le: string
          envoyee_par: string | null
          equipe_id: string
          evenement_id: string
          expire_le: string | null
          gagnante: boolean
          id: string
          theme_id: string
        }
        Insert: {
          chemin: string
          envoyee_le?: string
          envoyee_par?: string | null
          equipe_id: string
          evenement_id: string
          expire_le?: string | null
          gagnante?: boolean
          id?: string
          theme_id: string
        }
        Update: {
          chemin?: string
          envoyee_le?: string
          envoyee_par?: string | null
          equipe_id?: string
          evenement_id?: string
          expire_le?: string | null
          gagnante?: boolean
          id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_envoyee_par_fkey"
            columns: ["envoyee_par"]
            isOneToOne: false
            referencedRelation: "joueurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "classement"
            referencedColumns: ["equipe_id", "evenement_id"]
          },
          {
            foreignKeyName: "photos_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "photos_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "contenus"
            referencedColumns: ["id"]
          },
        ]
      }
      pilotage: {
        Row: {
          chrono_depart: string | null
          chrono_duree_s: number | null
          etape: string | null
          evenement_id: string
          indices: number
          maj_le: string
          manche_id: string | null
          passage_id: string | null
          scene: Database["public"]["Enums"]["scene"]
        }
        Insert: {
          chrono_depart?: string | null
          chrono_duree_s?: number | null
          etape?: string | null
          evenement_id: string
          indices?: number
          maj_le?: string
          manche_id?: string | null
          passage_id?: string | null
          scene?: Database["public"]["Enums"]["scene"]
        }
        Update: {
          chrono_depart?: string | null
          chrono_duree_s?: number | null
          etape?: string | null
          evenement_id?: string
          indices?: number
          maj_le?: string
          manche_id?: string | null
          passage_id?: string | null
          scene?: Database["public"]["Enums"]["scene"]
        }
        Relationships: [
          {
            foreignKeyName: "pilotage_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: true
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilotage_manche_id_evenement_id_fkey"
            columns: ["manche_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "manches"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "pilotage_passage_id_evenement_id_fkey"
            columns: ["passage_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id", "evenement_id"]
          },
        ]
      }
      reponses_quiz: {
        Row: {
          choix: number
          evenement_id: string
          joueur_id: string
          passage_id: string
          repondu_le: string
        }
        Insert: {
          choix: number
          evenement_id: string
          joueur_id: string
          passage_id: string
          repondu_le?: string
        }
        Update: {
          choix?: number
          evenement_id?: string
          joueur_id?: string
          passage_id?: string
          repondu_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "reponses_quiz_joueur_id_fkey"
            columns: ["joueur_id"]
            isOneToOne: false
            referencedRelation: "joueurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reponses_quiz_passage_id_evenement_id_fkey"
            columns: ["passage_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id", "evenement_id"]
          },
        ]
      }
      scores: {
        Row: {
          cree_le: string
          equipe_id: string
          evenement_id: string
          id: string
          manche_id: string | null
          motif: string
          points: number
          saisi_par: string | null
        }
        Insert: {
          cree_le?: string
          equipe_id: string
          evenement_id: string
          id?: string
          manche_id?: string | null
          motif: string
          points: number
          saisi_par?: string | null
        }
        Update: {
          cree_le?: string
          equipe_id?: string
          evenement_id?: string
          id?: string
          manche_id?: string | null
          motif?: string
          points?: number
          saisi_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "classement"
            referencedColumns: ["equipe_id", "evenement_id"]
          },
          {
            foreignKeyName: "scores_equipe_id_evenement_id_fkey"
            columns: ["equipe_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "scores_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_manche_id_evenement_id_fkey"
            columns: ["manche_id", "evenement_id"]
            isOneToOne: false
            referencedRelation: "manches"
            referencedColumns: ["id", "evenement_id"]
          },
          {
            foreignKeyName: "scores_saisi_par_fkey"
            columns: ["saisi_par"]
            isOneToOne: false
            referencedRelation: "animateurs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      classement: {
        Row: {
          equipe_id: string | null
          evenement_id: string | null
          nom: string | null
          numero: number | null
          points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipes_evenement_id_fkey"
            columns: ["evenement_id"]
            isOneToOne: false
            referencedRelation: "evenements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anime: { Args: { p_evenement: string }; Returns: boolean }
      contenu_public: {
        Args: {
          p_contenu: string
          p_langues: Database["public"]["Enums"]["langue"][]
        }
        Returns: Json
      }
      contenu_secret: {
        Args: {
          p_contenu: string
          p_langues: Database["public"]["Enums"]["langue"][]
        }
        Returns: Json
      }
      echanger_manches: {
        Args: { p_a: string; p_b: string }
        Returns: undefined
      }
      enregistrer_etape: {
        Args: {
          p_evenement: string
          p_manche?: Json
          p_passage?: Json
          p_pilotage: Json
          p_scores?: Json
          p_version: string
        }
        Returns: string
      }
      envoyer_photo: {
        Args: { p_chemin: string; p_jeton_hash: string; p_theme: string }
        Returns: Json
      }
      est_admin: { Args: never; Returns: boolean }
      est_animateur: { Args: never; Returns: boolean }
      etat_ecran: { Args: { p_code: string; p_regie?: boolean }; Returns: Json }
      etat_joueur: { Args: { p_jeton_hash: string }; Returns: Json }
      evenement_public: { Args: { p_code: string }; Returns: Json }
      nouveau_code: { Args: never; Returns: string }
      photos_du_joueur: {
        Args: { p_joueur: Database["public"]["Tables"]["joueurs"]["Row"] }
        Returns: Json
      }
      pouls_joueur: { Args: { p_jeton_hash: string }; Returns: Json }
      quiz_du_joueur: {
        Args: { p_joueur: Database["public"]["Tables"]["joueurs"]["Row"] }
        Returns: Json
      }
      quiz_joueurs: {
        Args: { p_manche: string }
        Returns: {
          elimine: boolean
          equipe_id: string
          joueur_id: string
        }[]
      }
      rejoindre_evenement: {
        Args: {
          p_code: string
          p_jeton_hash: string
          p_langue: Database["public"]["Enums"]["langue"]
          p_prenom: string
        }
        Returns: Json
      }
      repondre_quiz: {
        Args: { p_choix: number; p_jeton_hash: string }
        Returns: Json
      }
      secret_du_joueur: { Args: { p_jeton_hash: string }; Returns: Json }
      secret_visible: {
        Args: {
          p_jeu: Database["public"]["Enums"]["jeu"]
          p_langues: Database["public"]["Enums"]["langue"][]
          p_passage: Database["public"]["Tables"]["passages"]["Row"]
          p_pilotage: Database["public"]["Tables"]["pilotage"]["Row"]
          p_regie: boolean
        }
        Returns: Json
      }
      survivants_quiz: { Args: { p_manche: string }; Returns: Json }
    }
    Enums: {
      etiquette: "b2c" | "b2b" | "tout_public"
      jeu: "list2" | "qcm2" | "enchere2" | "mime2" | "photo2" | "grab" | "cup"
      langue: "fr" | "en" | "ta"
      role_animateur: "animateur" | "admin"
      scene:
        | "accueil"
        | "equipes"
        | "programme"
        | "intro"
        | "jeu"
        | "scores"
        | "podium"
      statut_evenement: "preparation" | "repetition" | "en_cours" | "termine"
      statut_manche: "a_venir" | "en_cours" | "terminee" | "annulee"
      statut_passage: "a_venir" | "en_cours" | "termine"
      type_client: "particulier" | "entreprise"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      etiquette: ["b2c", "b2b", "tout_public"],
      jeu: ["list2", "qcm2", "enchere2", "mime2", "photo2", "grab", "cup"],
      langue: ["fr", "en", "ta"],
      role_animateur: ["animateur", "admin"],
      scene: [
        "accueil",
        "equipes",
        "programme",
        "intro",
        "jeu",
        "scores",
        "podium",
      ],
      statut_evenement: ["preparation", "repetition", "en_cours", "termine"],
      statut_manche: ["a_venir", "en_cours", "terminee", "annulee"],
      statut_passage: ["a_venir", "en_cours", "termine"],
      type_client: ["particulier", "entreprise"],
    },
  },
} as const

