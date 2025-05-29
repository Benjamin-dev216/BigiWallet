// stores/useTicketStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@supabase/supabase-js";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  category_id: string;
  unread_count: number;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
}

interface TicketCategory {
  id: string;
  name: string;
  description: string;
}

interface TicketStore {
  tickets: Ticket[];
  categories: TicketCategory[];
  selectedTicket: Ticket | null;
  messages: TicketMessage[];
  loading: boolean;
  error: string | null;
  fetchTickets: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createTicket: (data: Partial<Ticket>) => Promise<void>;
  updateTicket: (id: string, data: Partial<Ticket>) => Promise<void>;
  fetchMessages: (ticketId: string) => Promise<void>;
  sendMessage: (
    ticketId: string,
    message: string,
    isAdmin?: boolean,
    imageUrl?: string
  ) => Promise<void>;
  uploadImage: (file: File, path: string) => Promise<string>;
  selectTicket: (ticket: Ticket | null) => void;
  resetTicket: () => void;
  addUnreadCount: (ticket_id: string) => void;
  resetUnreadCount: (ticket_id: string) => void;
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
    },
  }
);

export const useTicketStore = create<TicketStore>()(
  persist(
    (set, get) => ({
      tickets: [],
      categories: [],
      selectedTicket: null,
      messages: [],
      loading: false,
      error: null,

      fetchTickets: async () => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;
          set({ tickets: data });
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchCategories: async () => {
        try {
          const { data, error } = await supabase
            .from("ticket_categories")
            .select("*");

          if (error) throw error;
          set({ categories: data });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      createTicket: async (ticketData) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from("tickets")
            .insert([ticketData])
            .select()
            .single();

          if (error) throw error;
          set((state) => ({ tickets: [data, ...state.tickets] }));
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      updateTicket: async (id, ticketData) => {
        set({ loading: true, error: null });
        try {
          const { error } = await supabase
            .from("tickets")
            .update(ticketData)
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;

          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === id ? { ...ticket, ...ticketData } : ticket
            ),
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchMessages: async (ticketId) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from("ticket_messages")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true });

          if (error) throw error;
          set({ messages: data });
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      uploadImage: async (file: File, path: string) => {
        const { data, error } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(data.path);

        return publicUrl;
      },

      sendMessage: async (ticketId, message, isAdmin = false, imageUrl) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from("ticket_messages")
            .insert([
              {
                ticket_id: ticketId,
                message,
                sender_id: (await supabase.auth.getUser()).data.user?.id,
                is_admin: isAdmin ?? false,
                image_url: imageUrl,
              },
            ])
            .select()
            .single();

          if (error) throw error;
          set((state) => ({ messages: [...state.messages, data] }));
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      selectTicket: (ticket) => {
        set({ selectedTicket: ticket });
      },

      resetTicket: () => {
        set({
          tickets: [],
          selectedTicket: null,
        });
      },

      addUnreadCount: async (ticket_id) => {
        const ticket = get().tickets;
        const newTicket = ticket.map((ticket) => {
          if (ticket.id === ticket_id) {
            return {
              ...ticket,
              unread_count: (ticket.unread_count || 0) + 1,
            };
          }
          return ticket;
        });

        set({ tickets: newTicket });
        await supabase
          .from("tickets")
          .update({
            unread_count:
              newTicket.find((t) => t.id === ticket_id)?.unread_count || 1,
          })
          .eq("id", ticket_id);
      },

      resetUnreadCount: async (ticket_id) => {
        const ticket = get().tickets;
        const newTicket = ticket.map((ticket) => {
          if (ticket.id === ticket_id) {
            return { ...ticket, unread_count: 0 };
          }
          return ticket;
        });

        set({ tickets: newTicket });

        await supabase
          .from("tickets")
          .update({ unread_count: 0 })
          .eq("id", ticket_id);
      },
    }),
    {
      name: "ticket-store", // key in localStorage
      partialize: (state) => ({
        // persist only necessary state
        tickets: state.tickets,
        categories: state.categories,
        selectedTicket: state.selectedTicket,
      }),
    }
  )
);