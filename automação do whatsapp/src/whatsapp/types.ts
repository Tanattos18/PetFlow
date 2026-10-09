export interface InboundMessage {
  waMessageId: string;
  from: string;
  timestamp: string;
  type: string;
  text?: string;
  mediaId?: string;
  caption?: string;
  mimeType?: string;
}

export interface StatusUpdate {
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorMessage?: string;
}

export interface SendTextResult {
  waMessageId: string;
}

export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; caption?: string; filename?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          sticker?: { id: string; mime_type: string };
          location?: { latitude: number; longitude: number; address?: string; name?: string };
          interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
          button?: { text: string; payload: string };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          errors?: Array<{ code: number; title: string; message?: string }>;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}
