export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      animateurs: {
        Row: {
          actif: boolean;
          cree_le: string;
          id: string;
          nom: string;
          role: Database['public']['Enums']['role_animateur'];
        };
        Insert: {
          actif?: boolean;
          cree_le?: string;
          id: string;
          nom: string;
          role?: Database['public']['Enums']['role_animateur'];
        };
        Update: {
          actif?: boolean;
          cree_le?: string;
          id?: string;
          nom?: string;
          role?: Database['public']['Enums']['role_animateur'];
        };
        Relationships: [];
      };
      avis_joueurs: {
        Row: {
          citable: boolean;
          cree_le: string;
          evenement_id: string;
          id: string;
          joueur_id: string | null;
          langue: Database['public']['Enums']['langue'];
          modifie_le: string;
          negatif: string | null;
          positifs: string[];
          prenom: string | null;
          rien_a_redire: boolean;
        };
        Insert: {
          citable?: boolean;
          cree_le?: string;
          evenement_id: string;
          id?: string;
          joueur_id?: string | null;
          langue: Database['public']['Enums']['langue'];
          modifie_le?: string;
          negatif?: string | null;
          positifs: string[];
          prenom?: string | null;
          rien_a_redire?: boolean;
        };
        Update: {
          citable?: boolean;
          cree_le?: string;
          evenement_id?: string;
          id?: string;
          joueur_id?: string | null;
          langue?: Database['public']['Enums']['langue'];
          modifie_le?: string;
          negatif?: string | null;
          positifs?: string[];
          prenom?: string | null;
          rien_a_redire?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'avis_joueurs_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'avis_joueurs_joueur_id_fkey';
            columns: ['joueur_id'];
            isOneToOne: true;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
        ];
      };
      cartes_joueurs: {
        Row: {
          accord: boolean;
          age: number | null;
          anecdote: string | null;
          ecartee: boolean;
          evenement_id: string;
          joueur_id: string;
          maj_le: string;
          metier: string | null;
        };
        Insert: {
          accord?: boolean;
          age?: number | null;
          anecdote?: string | null;
          ecartee?: boolean;
          evenement_id: string;
          joueur_id: string;
          maj_le?: string;
          metier?: string | null;
        };
        Update: {
          accord?: boolean;
          age?: number | null;
          anecdote?: string | null;
          ecartee?: boolean;
          evenement_id?: string;
          joueur_id?: string;
          maj_le?: string;
          metier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cartes_joueurs_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cartes_joueurs_joueur_id_fkey';
            columns: ['joueur_id'];
            isOneToOne: true;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
        ];
      };
      contenus: {
        Row: {
          actif: boolean;
          cree_le: string;
          cree_par: string | null;
          etiquette: Database['public']['Enums']['etiquette'];
          evenement_id: string | null;
          extrait: string | null;
          extrait_duree_ms: number | null;
          id: string;
          jeu: Database['public']['Enums']['jeu'];
        };
        Insert: {
          actif?: boolean;
          cree_le?: string;
          cree_par?: string | null;
          etiquette?: Database['public']['Enums']['etiquette'];
          evenement_id?: string | null;
          extrait?: string | null;
          extrait_duree_ms?: number | null;
          id?: string;
          jeu: Database['public']['Enums']['jeu'];
        };
        Update: {
          actif?: boolean;
          cree_le?: string;
          cree_par?: string | null;
          etiquette?: Database['public']['Enums']['etiquette'];
          evenement_id?: string | null;
          extrait?: string | null;
          extrait_duree_ms?: number | null;
          id?: string;
          jeu?: Database['public']['Enums']['jeu'];
        };
        Relationships: [
          {
            foreignKeyName: 'contenus_cree_par_fkey';
            columns: ['cree_par'];
            isOneToOne: false;
            referencedRelation: 'animateurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contenus_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contenus_jeu_fkey';
            columns: ['jeu'];
            isOneToOne: false;
            referencedRelation: 'jeux';
            referencedColumns: ['code'];
          },
        ];
      };
      contenus_secrets: {
        Row: {
          contenu_id: string;
          langue: Database['public']['Enums']['langue'];
          valeur: Json;
        };
        Insert: {
          contenu_id: string;
          langue: Database['public']['Enums']['langue'];
          valeur: Json;
        };
        Update: {
          contenu_id?: string;
          langue?: Database['public']['Enums']['langue'];
          valeur?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'contenus_secrets_contenu_id_fkey';
            columns: ['contenu_id'];
            isOneToOne: false;
            referencedRelation: 'contenus';
            referencedColumns: ['id'];
          },
        ];
      };
      contenus_traductions: {
        Row: {
          contenu_id: string;
          langue: Database['public']['Enums']['langue'];
          valeur: Json;
        };
        Insert: {
          contenu_id: string;
          langue: Database['public']['Enums']['langue'];
          valeur?: Json;
        };
        Update: {
          contenu_id?: string;
          langue?: Database['public']['Enums']['langue'];
          valeur?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'contenus_traductions_contenu_id_fkey';
            columns: ['contenu_id'];
            isOneToOne: false;
            referencedRelation: 'contenus';
            referencedColumns: ['id'];
          },
        ];
      };
      equipes: {
        Row: {
          cree_le: string;
          evenement_id: string;
          id: string;
          nom: string;
          nom_fige: boolean;
          numero: number;
        };
        Insert: {
          cree_le?: string;
          evenement_id: string;
          id?: string;
          nom: string;
          nom_fige?: boolean;
          numero: number;
        };
        Update: {
          cree_le?: string;
          evenement_id?: string;
          id?: string;
          nom?: string;
          nom_fige?: boolean;
          numero?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'equipes_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
        ];
      };
      equipes_groupes: {
        Row: {
          effectif: number;
          equipe_id: string;
          evenement_id: string;
          groupe_id: string;
        };
        Insert: {
          effectif?: number;
          equipe_id: string;
          evenement_id: string;
          groupe_id: string;
        };
        Update: {
          effectif?: number;
          equipe_id?: string;
          evenement_id?: string;
          groupe_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'equipes_groupes_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id', 'evenement_id'];
          },
          {
            foreignKeyName: 'equipes_groupes_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'equipes_groupes_groupe_id_evenement_id_fkey';
            columns: ['groupe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'groupes';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      evenements: {
        Row: {
          animateur_id: string;
          carte_visible: boolean;
          client_nom: string;
          code: string;
          code_expire_le: string | null;
          commence_le: string | null;
          cree_le: string;
          creneau_minutes: number;
          date_evenement: string;
          equipes_prevues: number;
          groupe_facultatif: boolean;
          id: string;
          invites_attendus: number | null;
          langues: Database['public']['Enums']['langue'][];
          lieu: string | null;
          logo_initiales: string[] | null;
          logo_partenaire: string | null;
          logo_titre: string | null;
          occasion: string | null;
          photos_closes_le: string | null;
          statut: Database['public']['Enums']['statut_evenement'];
          termine_le: string | null;
          titre_public: string | null;
          type_client: Database['public']['Enums']['type_client'];
        };
        Insert: {
          animateur_id: string;
          carte_visible?: boolean;
          client_nom: string;
          code?: string;
          code_expire_le?: string | null;
          commence_le?: string | null;
          cree_le?: string;
          creneau_minutes: number;
          date_evenement: string;
          equipes_prevues?: number;
          groupe_facultatif?: boolean;
          id?: string;
          invites_attendus?: number | null;
          langues?: Database['public']['Enums']['langue'][];
          lieu?: string | null;
          logo_initiales?: string[] | null;
          logo_partenaire?: string | null;
          logo_titre?: string | null;
          occasion?: string | null;
          photos_closes_le?: string | null;
          statut?: Database['public']['Enums']['statut_evenement'];
          termine_le?: string | null;
          titre_public?: string | null;
          type_client?: Database['public']['Enums']['type_client'];
        };
        Update: {
          animateur_id?: string;
          carte_visible?: boolean;
          client_nom?: string;
          code?: string;
          code_expire_le?: string | null;
          commence_le?: string | null;
          cree_le?: string;
          creneau_minutes?: number;
          date_evenement?: string;
          equipes_prevues?: number;
          groupe_facultatif?: boolean;
          id?: string;
          invites_attendus?: number | null;
          langues?: Database['public']['Enums']['langue'][];
          lieu?: string | null;
          logo_initiales?: string[] | null;
          logo_partenaire?: string | null;
          logo_titre?: string | null;
          occasion?: string | null;
          photos_closes_le?: string | null;
          statut?: Database['public']['Enums']['statut_evenement'];
          termine_le?: string | null;
          titre_public?: string | null;
          type_client?: Database['public']['Enums']['type_client'];
        };
        Relationships: [
          {
            foreignKeyName: 'evenements_animateur_id_fkey';
            columns: ['animateur_id'];
            isOneToOne: false;
            referencedRelation: 'animateurs';
            referencedColumns: ['id'];
          },
        ];
      };
      grilles_portrait: {
        Row: {
          cartes: string[];
          maj_le: string;
          manche_id: string;
          noire: number;
        };
        Insert: {
          cartes: string[];
          maj_le?: string;
          manche_id: string;
          noire: number;
        };
        Update: {
          cartes?: string[];
          maj_le?: string;
          manche_id?: string;
          noire?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'grilles_portrait_manche_id_fkey';
            columns: ['manche_id'];
            isOneToOne: true;
            referencedRelation: 'manches';
            referencedColumns: ['id'];
          },
        ];
      };
      groupes: {
        Row: {
          evenement_id: string;
          id: string;
          nom: string;
          ordre: number;
        };
        Insert: {
          evenement_id: string;
          id?: string;
          nom: string;
          ordre: number;
        };
        Update: {
          evenement_id?: string;
          id?: string;
          nom?: string;
          ordre?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'groupes_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
        ];
      };
      jeux: {
        Row: {
          beta: boolean;
          chrono_passage_s: number | null;
          code: Database['public']['Enums']['jeu'];
          nom: string;
          ordre_affichage: number;
          sequentiel: boolean;
        };
        Insert: {
          beta?: boolean;
          chrono_passage_s?: number | null;
          code: Database['public']['Enums']['jeu'];
          nom: string;
          ordre_affichage: number;
          sequentiel: boolean;
        };
        Update: {
          beta?: boolean;
          chrono_passage_s?: number | null;
          code?: Database['public']['Enums']['jeu'];
          nom?: string;
          ordre_affichage?: number;
          sequentiel?: boolean;
        };
        Relationships: [];
      };
      joueurs: {
        Row: {
          capitaine: boolean;
          equipe_id: string | null;
          evenement_id: string;
          groupe_id: string | null;
          id: string;
          jeton_hash: string | null;
          langue: Database['public']['Enums']['langue'];
          nom_propose: string | null;
          peut_ajouter: boolean;
          prenom: string;
          rejoint_le: string;
          sans_telephone: boolean | null;
          volontaire: boolean;
          vu_le: string;
        };
        Insert: {
          capitaine?: boolean;
          equipe_id?: string | null;
          evenement_id: string;
          groupe_id?: string | null;
          id?: string;
          jeton_hash?: string | null;
          langue?: Database['public']['Enums']['langue'];
          nom_propose?: string | null;
          peut_ajouter?: boolean;
          prenom: string;
          rejoint_le?: string;
          sans_telephone?: boolean | null;
          volontaire?: boolean;
          vu_le?: string;
        };
        Update: {
          capitaine?: boolean;
          equipe_id?: string | null;
          evenement_id?: string;
          groupe_id?: string | null;
          id?: string;
          jeton_hash?: string | null;
          langue?: Database['public']['Enums']['langue'];
          nom_propose?: string | null;
          peut_ajouter?: boolean;
          prenom?: string;
          rejoint_le?: string;
          sans_telephone?: boolean | null;
          volontaire?: boolean;
          vu_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'joueurs_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id', 'evenement_id'];
          },
          {
            foreignKeyName: 'joueurs_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'joueurs_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'joueurs_groupe_id_evenement_id_fkey';
            columns: ['groupe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'groupes';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      manches: {
        Row: {
          commence_le: string | null;
          cree_le: string;
          evenement_id: string;
          fond: string | null;
          id: string;
          jeu: Database['public']['Enums']['jeu'];
          options: Json;
          ordre: number;
          statut: Database['public']['Enums']['statut_manche'];
          termine_le: string | null;
        };
        Insert: {
          commence_le?: string | null;
          cree_le?: string;
          evenement_id: string;
          fond?: string | null;
          id?: string;
          jeu: Database['public']['Enums']['jeu'];
          options?: Json;
          ordre: number;
          statut?: Database['public']['Enums']['statut_manche'];
          termine_le?: string | null;
        };
        Update: {
          commence_le?: string | null;
          cree_le?: string;
          evenement_id?: string;
          fond?: string | null;
          id?: string;
          jeu?: Database['public']['Enums']['jeu'];
          options?: Json;
          ordre?: number;
          statut?: Database['public']['Enums']['statut_manche'];
          termine_le?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'manches_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manches_jeu_fkey';
            columns: ['jeu'];
            isOneToOne: false;
            referencedRelation: 'jeux';
            referencedColumns: ['code'];
          },
        ];
      };
      matchs_tournoi: {
        Row: {
          equipe_a: number | null;
          equipe_b: number | null;
          evenement_id: string;
          gagnant: number | null;
          id: string;
          joueur_a: string | null;
          joueur_b: string | null;
          manche_id: string;
          poste: number | null;
          prenom_a: string | null;
          prenom_b: string | null;
          rang: number;
          sequence: number | null;
          tour: number;
        };
        Insert: {
          equipe_a?: number | null;
          equipe_b?: number | null;
          evenement_id: string;
          gagnant?: number | null;
          id?: string;
          joueur_a?: string | null;
          joueur_b?: string | null;
          manche_id: string;
          poste?: number | null;
          prenom_a?: string | null;
          prenom_b?: string | null;
          rang: number;
          sequence?: number | null;
          tour: number;
        };
        Update: {
          equipe_a?: number | null;
          equipe_b?: number | null;
          evenement_id?: string;
          gagnant?: number | null;
          id?: string;
          joueur_a?: string | null;
          joueur_b?: string | null;
          manche_id?: string;
          poste?: number | null;
          prenom_a?: string | null;
          prenom_b?: string | null;
          rang?: number;
          sequence?: number | null;
          tour?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'matchs_tournoi_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matchs_tournoi_joueur_a_fkey';
            columns: ['joueur_a'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matchs_tournoi_joueur_b_fkey';
            columns: ['joueur_b'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matchs_tournoi_manche_id_fkey';
            columns: ['manche_id'];
            isOneToOne: false;
            referencedRelation: 'manches';
            referencedColumns: ['id'];
          },
        ];
      };
      messages_salle: {
        Row: {
          cree_le: string;
          equipe_id: string | null;
          evenement_id: string;
          id: string;
          joueur_id: string | null;
          prenom: string | null;
          regie: boolean;
          retire: boolean;
          texte: string;
        };
        Insert: {
          cree_le?: string;
          equipe_id?: string | null;
          evenement_id: string;
          id?: string;
          joueur_id?: string | null;
          prenom?: string | null;
          regie?: boolean;
          retire?: boolean;
          texte: string;
        };
        Update: {
          cree_le?: string;
          equipe_id?: string | null;
          evenement_id?: string;
          id?: string;
          joueur_id?: string | null;
          prenom?: string | null;
          regie?: boolean;
          retire?: boolean;
          texte?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_salle_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id'];
          },
          {
            foreignKeyName: 'messages_salle_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_salle_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_salle_joueur_id_fkey';
            columns: ['joueur_id'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
        ];
      };
      mises_quiz: {
        Row: {
          debloquee: boolean;
          equipe_id: string;
          evenement_id: string;
          maj_le: string;
          passage_id: string;
          repartition: number[];
          valide: boolean;
        };
        Insert: {
          debloquee?: boolean;
          equipe_id: string;
          evenement_id: string;
          maj_le?: string;
          passage_id: string;
          repartition?: number[];
          valide?: boolean;
        };
        Update: {
          debloquee?: boolean;
          equipe_id?: string;
          evenement_id?: string;
          maj_le?: string;
          passage_id?: string;
          repartition?: number[];
          valide?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'mises_quiz_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id'];
          },
          {
            foreignKeyName: 'mises_quiz_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mises_quiz_passage_id_evenement_id_fkey';
            columns: ['passage_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'passages';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      mots_surenchere: {
        Row: {
          ajoute_le: string;
          cle: string;
          equipe_id: string;
          evenement_id: string;
          id: string;
          masque: boolean;
          mot: string;
          passage_id: string;
          refuse: boolean;
        };
        Insert: {
          ajoute_le?: string;
          cle: string;
          equipe_id: string;
          evenement_id: string;
          id?: string;
          masque?: boolean;
          mot: string;
          passage_id: string;
          refuse?: boolean;
        };
        Update: {
          ajoute_le?: string;
          cle?: string;
          equipe_id?: string;
          evenement_id?: string;
          id?: string;
          masque?: boolean;
          mot?: string;
          passage_id?: string;
          refuse?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'mots_surenchere_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id'];
          },
          {
            foreignKeyName: 'mots_surenchere_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mots_surenchere_passage_id_evenement_id_fkey';
            columns: ['passage_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'passages';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      musiques: {
        Row: {
          actif: boolean;
          artiste: string | null;
          chemin: string;
          cree_le: string;
          id: string;
          paroles: Json | null;
          taille: number;
          titre: string;
        };
        Insert: {
          actif?: boolean;
          artiste?: string | null;
          chemin: string;
          cree_le?: string;
          id?: string;
          paroles?: Json | null;
          taille: number;
          titre: string;
        };
        Update: {
          actif?: boolean;
          artiste?: string | null;
          chemin?: string;
          cree_le?: string;
          id?: string;
          paroles?: Json | null;
          taille?: number;
          titre?: string;
        };
        Relationships: [];
      };
      passages: {
        Row: {
          commence_le: string | null;
          contenu_id: string | null;
          equipe_id: string | null;
          evenement_id: string;
          id: string;
          joueur_designe_id: string | null;
          manche_id: string;
          ordre: number;
          points: number | null;
          resultat: Json;
          statut: Database['public']['Enums']['statut_passage'];
          termine_le: string | null;
        };
        Insert: {
          commence_le?: string | null;
          contenu_id?: string | null;
          equipe_id?: string | null;
          evenement_id: string;
          id?: string;
          joueur_designe_id?: string | null;
          manche_id: string;
          ordre: number;
          points?: number | null;
          resultat?: Json;
          statut?: Database['public']['Enums']['statut_passage'];
          termine_le?: string | null;
        };
        Update: {
          commence_le?: string | null;
          contenu_id?: string | null;
          equipe_id?: string | null;
          evenement_id?: string;
          id?: string;
          joueur_designe_id?: string | null;
          manche_id?: string;
          ordre?: number;
          points?: number | null;
          resultat?: Json;
          statut?: Database['public']['Enums']['statut_passage'];
          termine_le?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'passages_contenu_id_fkey';
            columns: ['contenu_id'];
            isOneToOne: false;
            referencedRelation: 'contenus';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passages_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id', 'evenement_id'];
          },
          {
            foreignKeyName: 'passages_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'passages_joueur_designe_id_fkey';
            columns: ['joueur_designe_id'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passages_manche_id_evenement_id_fkey';
            columns: ['manche_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'manches';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      photos: {
        Row: {
          chemin: string;
          envoyee_le: string;
          envoyee_par: string | null;
          equipe_id: string;
          evenement_id: string;
          expire_le: string;
          gagnante: boolean;
          id: string;
          theme_id: string;
        };
        Insert: {
          chemin: string;
          envoyee_le?: string;
          envoyee_par?: string | null;
          equipe_id: string;
          evenement_id: string;
          expire_le: string;
          gagnante?: boolean;
          id?: string;
          theme_id: string;
        };
        Update: {
          chemin?: string;
          envoyee_le?: string;
          envoyee_par?: string | null;
          equipe_id?: string;
          evenement_id?: string;
          expire_le?: string;
          gagnante?: boolean;
          id?: string;
          theme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_envoyee_par_fkey';
            columns: ['envoyee_par'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id', 'evenement_id'];
          },
          {
            foreignKeyName: 'photos_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'photos_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_theme_id_fkey';
            columns: ['theme_id'];
            isOneToOne: false;
            referencedRelation: 'contenus';
            referencedColumns: ['id'];
          },
        ];
      };
      pilotage: {
        Row: {
          avis_ouverts: boolean;
          bruitage: Json | null;
          chrono_depart: string | null;
          chrono_duree_s: number | null;
          etape: string | null;
          evenement_id: string;
          habillage: boolean;
          indices: number;
          maj_le: string;
          manche_id: string | null;
          membres_mode: string;
          messages_ouverts: boolean;
          passage_id: string | null;
          podium_depart: string | null;
          podium_publie: Json | null;
          scene: Database['public']['Enums']['scene'];
          son_actif: boolean;
          son_volume: number;
        };
        Insert: {
          avis_ouverts?: boolean;
          bruitage?: Json | null;
          chrono_depart?: string | null;
          chrono_duree_s?: number | null;
          etape?: string | null;
          evenement_id: string;
          habillage?: boolean;
          indices?: number;
          maj_le?: string;
          manche_id?: string | null;
          membres_mode?: string;
          messages_ouverts?: boolean;
          passage_id?: string | null;
          podium_depart?: string | null;
          podium_publie?: Json | null;
          scene?: Database['public']['Enums']['scene'];
          son_actif?: boolean;
          son_volume?: number;
        };
        Update: {
          avis_ouverts?: boolean;
          bruitage?: Json | null;
          chrono_depart?: string | null;
          chrono_duree_s?: number | null;
          etape?: string | null;
          evenement_id?: string;
          habillage?: boolean;
          indices?: number;
          maj_le?: string;
          manche_id?: string | null;
          membres_mode?: string;
          messages_ouverts?: boolean;
          passage_id?: string | null;
          podium_depart?: string | null;
          podium_publie?: Json | null;
          scene?: Database['public']['Enums']['scene'];
          son_actif?: boolean;
          son_volume?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pilotage_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: true;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pilotage_manche_id_evenement_id_fkey';
            columns: ['manche_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'manches';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'pilotage_passage_id_evenement_id_fkey';
            columns: ['passage_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'passages';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      reponses_quiz: {
        Row: {
          choix: number;
          evenement_id: string;
          joueur_id: string;
          passage_id: string;
          repondu_le: string;
        };
        Insert: {
          choix: number;
          evenement_id: string;
          joueur_id: string;
          passage_id: string;
          repondu_le?: string;
        };
        Update: {
          choix?: number;
          evenement_id?: string;
          joueur_id?: string;
          passage_id?: string;
          repondu_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reponses_quiz_joueur_id_fkey';
            columns: ['joueur_id'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reponses_quiz_passage_id_evenement_id_fkey';
            columns: ['passage_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'passages';
            referencedColumns: ['id', 'evenement_id'];
          },
        ];
      };
      scores: {
        Row: {
          cree_le: string;
          equipe_id: string;
          evenement_id: string;
          id: string;
          manche_id: string | null;
          motif: string;
          points: number;
          saisi_par: string | null;
        };
        Insert: {
          cree_le?: string;
          equipe_id: string;
          evenement_id: string;
          id?: string;
          manche_id?: string | null;
          motif: string;
          points: number;
          saisi_par?: string | null;
        };
        Update: {
          cree_le?: string;
          equipe_id?: string;
          evenement_id?: string;
          id?: string;
          manche_id?: string | null;
          motif?: string;
          points?: number;
          saisi_par?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scores_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id', 'evenement_id'];
          },
          {
            foreignKeyName: 'scores_equipe_id_evenement_id_fkey';
            columns: ['equipe_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'scores_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scores_manche_id_evenement_id_fkey';
            columns: ['manche_id', 'evenement_id'];
            isOneToOne: false;
            referencedRelation: 'manches';
            referencedColumns: ['id', 'evenement_id'];
          },
          {
            foreignKeyName: 'scores_saisi_par_fkey';
            columns: ['saisi_par'];
            isOneToOne: false;
            referencedRelation: 'animateurs';
            referencedColumns: ['id'];
          },
        ];
      };
      themes_soiree: {
        Row: {
          cree_le: string;
          evenement_id: string;
          fichiers: Json;
          reglages: Json;
          theme: string;
        };
        Insert: {
          cree_le?: string;
          evenement_id: string;
          fichiers: Json;
          reglages?: Json;
          theme: string;
        };
        Update: {
          cree_le?: string;
          evenement_id?: string;
          fichiers?: Json;
          reglages?: Json;
          theme?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'themes_soiree_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: true;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
        ];
      };
      tirages_cartes: {
        Row: {
          cree_le: string;
          equipe_id: string;
          evenement_id: string;
          id: string;
          joueur_id: string | null;
          manche_id: string | null;
        };
        Insert: {
          cree_le?: string;
          equipe_id: string;
          evenement_id: string;
          id?: string;
          joueur_id?: string | null;
          manche_id?: string | null;
        };
        Update: {
          cree_le?: string;
          equipe_id?: string;
          evenement_id?: string;
          id?: string;
          joueur_id?: string | null;
          manche_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tirages_cartes_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id'];
          },
          {
            foreignKeyName: 'tirages_cartes_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tirages_cartes_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tirages_cartes_joueur_id_fkey';
            columns: ['joueur_id'];
            isOneToOne: false;
            referencedRelation: 'joueurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tirages_cartes_manche_id_fkey';
            columns: ['manche_id'];
            isOneToOne: false;
            referencedRelation: 'manches';
            referencedColumns: ['id'];
          },
        ];
      };
      votes_portrait: {
        Row: {
          carte: number;
          equipe_id: string;
          id: string;
          passage_id: string;
          tour: number;
          vote_le: string;
        };
        Insert: {
          carte: number;
          equipe_id: string;
          id?: string;
          passage_id: string;
          tour: number;
          vote_le?: string;
        };
        Update: {
          carte?: number;
          equipe_id?: string;
          id?: string;
          passage_id?: string;
          tour?: number;
          vote_le?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'votes_portrait_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'classement';
            referencedColumns: ['equipe_id'];
          },
          {
            foreignKeyName: 'votes_portrait_equipe_id_fkey';
            columns: ['equipe_id'];
            isOneToOne: false;
            referencedRelation: 'equipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_portrait_passage_id_fkey';
            columns: ['passage_id'];
            isOneToOne: false;
            referencedRelation: 'passages';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      classement: {
        Row: {
          equipe_id: string | null;
          evenement_id: string | null;
          nom: string | null;
          numero: number | null;
          points: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'equipes_evenement_id_fkey';
            columns: ['evenement_id'];
            isOneToOne: false;
            referencedRelation: 'evenements';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      ajouter_invite: {
        Args: { p_groupe?: string; p_jeton_parrain: string; p_prenom: string };
        Returns: Json;
      };
      ajouter_invite_regie: {
        Args: { p_evenement: string; p_groupe?: string; p_prenom: string };
        Returns: Json;
      };
      ajouter_mot: {
        Args: { p_jeton_hash: string; p_mot: string };
        Returns: Json;
      };
      anime: { Args: { p_evenement: string }; Returns: boolean };
      annuaire_animateurs: {
        Args: never;
        Returns: {
          actif: boolean;
          cree_le: string;
          email: string;
          id: string;
          nom: string;
          role: Database['public']['Enums']['role_animateur'];
        }[];
      };
      avis_positifs_valides: {
        Args: { p_positifs: string[] };
        Returns: boolean;
      };
      blind_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      buzzer_blind: { Args: { p_jeton_hash: string }; Returns: Json };
      capitaine_aux_mots: {
        Args: { p_jeton_hash: string };
        Returns: {
          equipe_id: string;
          evenement_id: string;
          passage_id: string;
        }[];
      };
      cartes_portrait_valides: {
        Args: { p_cartes: string[] };
        Returns: boolean;
      };
      cartes_pretes: { Args: { p_evenement: string }; Returns: number };
      changer_langue: {
        Args: {
          p_jeton_hash: string;
          p_langue: Database['public']['Enums']['langue'];
        };
        Returns: Json;
      };
      chrono_mots_ouvert: {
        Args: { p_pilotage: Database['public']['Tables']['pilotage']['Row'] };
        Returns: boolean;
      };
      classement_du_joueur: {
        Args: { p_pilotage: Database['public']['Tables']['pilotage']['Row'] };
        Returns: Json;
      };
      classement_podium: { Args: { p_evenement: string }; Returns: Json };
      cle_prenom: { Args: { p_prenom: string }; Returns: string };
      connaissance_ecran: {
        Args: {
          p_evenement: string;
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
          p_regie: boolean;
        };
        Returns: Json;
      };
      contenu_bien_forme: {
        Args: {
          p_jeu: Database['public']['Enums']['jeu'];
          p_public: Json;
          p_secret: Json;
        };
        Returns: boolean;
      };
      contenu_lisible: { Args: { p_contenu: string }; Returns: boolean };
      contenu_public: {
        Args: {
          p_contenu: string;
          p_langues: Database['public']['Enums']['langue'][];
        };
        Returns: Json;
      };
      contenu_secret: {
        Args: {
          p_contenu: string;
          p_langues: Database['public']['Enums']['langue'][];
        };
        Returns: Json;
      };
      debloquer_mise: {
        Args: { p_equipe: string; p_passage: string };
        Returns: undefined;
      };
      donner_avis: {
        Args: {
          p_citable: boolean;
          p_jeton_hash: string;
          p_negatif: string;
          p_positifs: string[];
          p_rien_a_redire: boolean;
        };
        Returns: Json;
      };
      duelliste_json: {
        Args: { p_equipe: number; p_joueur: string; p_prenom: string };
        Returns: Json;
      };
      ecarter_carte: { Args: { p_joueur: string }; Returns: undefined };
      echanger_manches: {
        Args: { p_a: string; p_b: string };
        Returns: undefined;
      };
      enregistrer_carte: {
        Args: {
          p_accord: boolean;
          p_age: number;
          p_anecdote: string;
          p_jeton_hash: string;
          p_metier: string;
        };
        Returns: Json;
      };
      enregistrer_contenu: {
        Args: {
          p_etiquette: Database['public']['Enums']['etiquette'];
          p_extrait?: Json;
          p_id: string;
          p_jeu: Database['public']['Enums']['jeu'];
          p_langues: Json;
        };
        Returns: string;
      };
      enregistrer_etape: {
        Args: {
          p_evenement: string;
          p_manche?: Json;
          p_passage?: Json;
          p_pilotage: Json;
          p_scores?: Json;
          p_version: string;
        };
        Returns: string;
      };
      enregistrer_proche: {
        Args: {
          p_actif?: boolean;
          p_evenement: string;
          p_id: string;
          p_langues: Json;
        };
        Returns: string;
      };
      envoyer_message: {
        Args: { p_jeton_hash: string; p_texte: string };
        Returns: Json;
      };
      envoyer_message_regie: {
        Args: { p_evenement: string; p_texte: string };
        Returns: string;
      };
      envoyer_photo: {
        Args: { p_chemin: string; p_jeton_hash: string; p_theme: string };
        Returns: Json;
      };
      est_admin: { Args: never; Returns: boolean };
      est_animateur: { Args: never; Returns: boolean };
      etat_ecran: { Args: { p_code: string; p_regie?: boolean }; Returns: Json };
      etat_joueur: { Args: { p_jeton_hash: string }; Returns: Json };
      evenement_public: { Args: { p_code: string }; Returns: Json };
      expiration_photo: { Args: { p_evenement: string }; Returns: string };
      former_equipes: {
        Args: { p_equipes: Json; p_evenement: string; p_passages: Json };
        Returns: number;
      };
      grille_portrait_ecran: {
        Args: {
          p_langues: Database['public']['Enums']['langue'][];
          p_manche: Database['public']['Tables']['manches']['Row'];
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
          p_regie: boolean;
        };
        Returns: Json;
      };
      jetons_quiz: {
        Args: { p_manche: string };
        Returns: {
          depart: number;
          equipe_id: string;
          numero: number;
          restants: number;
        }[];
      };
      jeu_par_equipe: {
        Args: { p_jeu: Database['public']['Enums']['jeu'] };
        Returns: boolean;
      };
      jouer_bruitage: {
        Args: { p_evenement: string; p_son: string };
        Returns: undefined;
      };
      lignes_tableau: {
        Args: { p_premier_tour: Json };
        Returns: {
          a: string;
          b: string;
          rang: number;
        }[];
      };
      messages_ecran: {
        Args: { p_evenement: string; p_regie: boolean };
        Returns: Json;
      };
      miser_quiz: {
        Args: {
          p_jeton_hash: string;
          p_repartition: number[];
          p_valider: boolean;
        };
        Returns: Json;
      };
      monogramme_valide: { Args: { p_initiales: string[] }; Returns: boolean };
      mots_de_l_equipe: {
        Args: { p_equipe: string; p_passage: string };
        Returns: Json;
      };
      mots_ecran: {
        Args: {
          p_passage: Database['public']['Tables']['passages']['Row'];
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
          p_regie: boolean;
        };
        Returns: Json;
      };
      nettoyer_avis: {
        Args: { p_lignes: boolean; p_max: number; p_texte: string };
        Returns: string;
      };
      nettoyer_message: { Args: { p_texte: string }; Returns: string };
      nouveau_code: { Args: never; Returns: string };
      ordonner_passages: {
        Args: { p_manche: string; p_passages: string[] };
        Returns: undefined;
      };
      ouvrir_sequence: {
        Args: {
          p_gobelets: number;
          p_manche: string;
          p_matchs: string[];
          p_numero: number;
          p_pilotage: Json;
          p_version: string;
        };
        Returns: string;
      };
      paroles_bien_formees: { Args: { p_paroles: Json }; Returns: boolean };
      photos_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      placer_joueur: {
        Args: {
          p_evenement: Database['public']['Tables']['evenements']['Row'];
          p_groupe: string;
          p_jeton_hash: string;
          p_langue: Database['public']['Enums']['langue'];
          p_nom_propose?: string;
          p_prenom: string;
          p_volontaire?: boolean;
        };
        Returns: Json;
      };
      portrait_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      portrait_eliminees: { Args: { p_manche: string }; Returns: number[] };
      portrait_retournees: { Args: { p_manche: string }; Returns: number[] };
      poser_tableau: {
        Args: { p_gobelets: number; p_manche: string; p_premier_tour: Json };
        Returns: number;
      };
      pouls_joueur: { Args: { p_jeton_hash: string }; Returns: Json };
      prenom_disponible: {
        Args: { p_code: string; p_prenom: string };
        Returns: boolean;
      };
      proposer_nom: {
        Args: { p_jeton_hash: string; p_nom: string };
        Returns: Json;
      };
      quiz_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      quiz_elimination: {
        Args: {
          p_joueur: Database['public']['Tables']['joueurs']['Row'];
          p_manche: string;
        };
        Returns: boolean;
      };
      quiz_jetons_du_joueur: {
        Args: {
          p_joueur: Database['public']['Tables']['joueurs']['Row'];
          p_manche: Database['public']['Tables']['manches']['Row'];
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
        };
        Returns: Json;
      };
      quiz_joueurs: {
        Args: { p_manche: string };
        Returns: {
          elimine: boolean;
          equipe_id: string;
          joueur_id: string;
        }[];
      };
      recommencer_manche: {
        Args: { p_manche: string; p_motif: string };
        Returns: string;
      };
      refuser_mot: {
        Args: { p_mot: string; p_refuse: boolean };
        Returns: undefined;
      };
      regler_avis: {
        Args: { p_evenement: string; p_ouverts: boolean };
        Returns: undefined;
      };
      regler_habillage: {
        Args: { p_actif: boolean; p_evenement: string };
        Returns: undefined;
      };
      regler_membres: {
        Args: { p_evenement: string; p_mode: string };
        Returns: undefined;
      };
      regler_messages: {
        Args: { p_evenement: string; p_ouverts: boolean };
        Returns: undefined;
      };
      regler_son: {
        Args: { p_actif: boolean; p_evenement: string; p_volume: number };
        Returns: undefined;
      };
      rejoindre_evenement: {
        Args: {
          p_code: string;
          p_groupe?: string;
          p_jeton_hash: string;
          p_langue: Database['public']['Enums']['langue'];
          p_nom_propose?: string;
          p_prenom: string;
          p_volontaire?: boolean;
        };
        Returns: Json;
      };
      renommer_equipe: {
        Args: { p_jeton_hash: string; p_nom: string };
        Returns: Json;
      };
      repondre_quiz: {
        Args: { p_choix: number; p_jeton_hash: string };
        Returns: Json;
      };
      resultat_match: {
        Args: { p_gagnant: number; p_match: string };
        Returns: undefined;
      };
      retirer_message: {
        Args: { p_message: string; p_retire?: boolean };
        Returns: undefined;
      };
      retirer_mot: {
        Args: { p_jeton_hash: string; p_mot: string };
        Returns: Json;
      };
      secret_du_joueur: { Args: { p_jeton_hash: string }; Returns: Json };
      secret_visible: {
        Args: {
          p_jeu: Database['public']['Enums']['jeu'];
          p_langues: Database['public']['Enums']['langue'][];
          p_passage: Database['public']['Tables']['passages']['Row'];
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
          p_regie: boolean;
        };
        Returns: Json;
      };
      soirees_du_jour: { Args: never; Returns: Json };
      surenchere_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      survivants_quiz: { Args: { p_manche: string }; Returns: Json };
      texte_rempli: { Args: { p_valeur: Json }; Returns: boolean };
      tirer_capitaines: { Args: { p_evenement: string }; Returns: number };
      tirer_carte: {
        Args: { p_equipe: string; p_evenement: string; p_manche: string };
        Returns: Json;
      };
      tournoi_du_joueur: {
        Args: { p_joueur: Database['public']['Tables']['joueurs']['Row'] };
        Returns: Json;
      };
      tournoi_ecran: {
        Args: {
          p_evenement: string;
          p_pilotage: Database['public']['Tables']['pilotage']['Row'];
        };
        Returns: Json;
      };
      verifier_vote_portrait: {
        Args: {
          p_carte: number;
          p_manche: string;
          p_numero: number;
          p_passage: Database['public']['Tables']['passages']['Row'];
        };
        Returns: undefined;
      };
      voter_portrait: {
        Args: { p_carte: number; p_jeton_hash: string };
        Returns: Json;
      };
      voter_portrait_regie: {
        Args: { p_carte: number; p_equipe: string; p_passage: string };
        Returns: undefined;
      };
      votes_portrait_ecran: {
        Args: { p_passage: string; p_regie: boolean; p_tour: number };
        Returns: Json;
      };
    };
    Enums: {
      etiquette: 'b2c' | 'b2b' | 'tout_public';
      jeu:
        | 'list2'
        | 'qcm2'
        | 'enchere2'
        | 'mime2'
        | 'photo2'
        | 'grab'
        | 'cup'
        | 'blind'
        | 'portrait'
        | 'cinemime';
      langue: 'fr' | 'en' | 'ta';
      role_animateur: 'animateur' | 'admin';
      scene:
        | 'ouverture'
        | 'accueil'
        | 'equipes'
        | 'programme'
        | 'intro'
        | 'jeu'
        | 'scores'
        | 'connaissance'
        | 'podium'
        | 'instagram'
        | 'cloture';
      statut_evenement: 'preparation' | 'repetition' | 'en_cours' | 'termine';
      statut_manche: 'a_venir' | 'en_cours' | 'terminee' | 'annulee';
      statut_passage: 'a_venir' | 'en_cours' | 'termine';
      type_client: 'particulier' | 'entreprise';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      etiquette: ['b2c', 'b2b', 'tout_public'],
      jeu: [
        'list2',
        'qcm2',
        'enchere2',
        'mime2',
        'photo2',
        'grab',
        'cup',
        'blind',
        'portrait',
        'cinemime',
      ],
      langue: ['fr', 'en', 'ta'],
      role_animateur: ['animateur', 'admin'],
      scene: [
        'ouverture',
        'accueil',
        'equipes',
        'programme',
        'intro',
        'jeu',
        'scores',
        'connaissance',
        'podium',
        'instagram',
        'cloture',
      ],
      statut_evenement: ['preparation', 'repetition', 'en_cours', 'termine'],
      statut_manche: ['a_venir', 'en_cours', 'terminee', 'annulee'],
      statut_passage: ['a_venir', 'en_cours', 'termine'],
      type_client: ['particulier', 'entreprise'],
    },
  },
} as const;
