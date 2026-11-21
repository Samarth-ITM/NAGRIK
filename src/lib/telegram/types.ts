/**
 * Telegram Bot API Types for Nagrik
 * Authority: TRD Section 8 & Telegram Bot API v7+
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramKeyboardButton {
  text: string;
  request_location?: boolean;
  request_contact?: boolean;
}

export interface TelegramReplyKeyboardMarkup {
  keyboard: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
}

export interface TelegramReplyKeyboardRemove {
  remove_keyboard: true;
}

export type TelegramReplyMarkup =
  | TelegramInlineKeyboardMarkup
  | TelegramReplyKeyboardMarkup
  | TelegramReplyKeyboardRemove;

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  photo?: TelegramPhotoSize[];
  voice?: TelegramVoice;
  location?: TelegramLocation;
  caption?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export type ConversationState =
  | "IDLE"
  | "AWAITING_AUTH_NAME"
  | "AWAITING_AUTH_PASSWORD"
  | "AWAITING_SESSION_PASSWORD"
  | "AWAITING_LANGUAGE"
  | "AWAITING_GROUP"
  | "AWAITING_CATEGORY"
  | "AWAITING_ISSUE_TYPE"
  | "AWAITING_VOICE_DESCRIPTION"
  | "CONFIRM_VOICE_TRANSCRIPT"
  | "AWAITING_DESCRIPTION"
  | "AWAITING_LOCATION"
  | "AWAITING_PHOTO"
  | "AWAITING_PHOTO_RETRY"
  | "AWAITING_VOICE"
  | "CONFIRM_SUBMISSION";

export interface DraftPayload {
  sessionUnlocked?: boolean;
  authNamePending?: string;
  language?: "en" | "hi" | "mr";
  /** Set when the citizen tapped "Report" — after picking a language we go straight into the report flow. */
  reportAfterLanguage?: boolean;
  /** When the citizen last picked a language (ms). "Report" skips the language question for 15 minutes. */
  languageChosenAt?: number;
  groupId?: string;
  categoryId?: string;
  issueTypeId?: string;
  customIssueNote?: string;
  description?: string;
  transcriptPending?: string;
  voiceTranscript?: string;
  latitude?: number;
  longitude?: number;
  horizontalAccuracyM?: number;
  locationSource?: "telegram_location" | "manual_pin" | "landmark";
  photoStoragePath?: string;
  photoMimeType?: string;
  photoSizeBytes?: number;
  photoSha256?: string;
  photoFileUniqueId?: string;
  photoValidationStatus?: "MATCH" | "MISMATCH" | "UNCLEAR" | "UNVERIFIED";
  photoValidationReason?: string;
  validatedPhotoSha256?: string;
  validatedIssueTypeId?: string;
  voiceStoragePath?: string;
  voiceSizeBytes?: number;
  voiceSha256?: string;
  voiceFileUniqueId?: string;
}
