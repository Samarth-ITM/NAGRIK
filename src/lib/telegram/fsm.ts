import {
  NAGRIK_TAXONOMY_V1,
  getTaxonomyGroup,
  getTaxonomyCategory,
  getTaxonomyIssueOption,
  getResolvedLabel,
  type SupportedLanguage,
} from "@/lib/taxonomy/nagrik-taxonomy.v1";
import { PILOT_CONFIG } from "@/lib/config/pilot";
import { calculateHaversineDistanceMetres } from "@/lib/geospatial/haversine";
import { TelegramBotClient } from "./bot";
import { TelegramMediaService } from "./media";
import { deriveCitizenUserHash, encryptTelegramChatId } from "./crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  ConversationState,
  DraftPayload,
  TelegramInlineKeyboardMarkup,
} from "./types";

/**
 * Localized bot interface strings
 */
const MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    welcome:
      "<b>Welcome to Nagrik!</b>\nYour civic intelligence and grievance portal for Kharghar Sector 4.\n\nUse /report to report a civic issue.\nUse /language to change language.\nUse /cancel to stop at any time.",
    choose_language: "Please choose your preferred language:",
    choose_group: "<b>Step 1 of 6:</b> Select the issue domain:",
    choose_category: "<b>Step 2 of 6:</b> Select the specific category:",
    choose_issue: "<b>Step 3 of 6:</b> Select the specific issue:",
    other_option: "Other (Describe yourself)",
    enter_description:
      "<b>Step 4 of 6:</b> Please enter a short description of the issue (up to 500 characters):",
    desc_too_long: "Description exceeds 500 characters. Please provide a shorter description:",
    send_location:
      "<b>Step 5 of 6:</b> Please send the location of the issue using Telegram's location button, or tap 'Use Pilot Default' for test mode:",
    location_received: "Location recorded successfully.",
    send_photo:
      "<b>Step 6 of 6:</b> Please take or send a clear photograph showing the civic defect:",
    photo_received: "Photograph received and securely stored.",
    send_voice:
      "<b>Optional:</b> You may record a short voice message describing the issue, or tap 'Skip':",
    skip_voice: "Skip Voice Note",
    review_title: "<b>Please Review Your Report:</b>",
    confirm_btn: "Confirm & Submit",
    cancel_btn: "Cancel",
    report_submitted:
      "<b>Report Submitted Successfully!</b>\n\nYour Ticket Reference: <code>{ticket_code}</code>\n\nYour issue has been recorded in the civic grievance queue for super-admin verification. You can track this ticket anytime using this reference.",
    cancelled: "Report draft cancelled. Type /report to start again.",
    help: "<b>Nagrik Help & Privacy:</b>\n- Your reports are pseudonymous; personal identifiers are never stored.\n- Municipal authorities receive verified issues for physical repair.\n- Commands: /report, /language, /cancel, /help.",
    invalid_input: "Unrecognised input. Please use the buttons provided or type /cancel.",
  },
  hi: {
    welcome:
      "<b>नागरिक में आपका स्वागत है!</b>\nखारघर सेक्टर 4 के लिए आपका नागरिक पोर्टल।\n\nसमस्या दर्ज करने के लिए /report टाइप करें।\nभाषा बदलने के लिए /language चुनें।\nरद्द करने के लिए /cancel टाइप करें।",
    choose_language: "कृपया अपनी पसंदीदा भाषा चुनें:",
    choose_group: "<b>चरण 1/6:</b> समस्या का मुख्य क्षेत्र चुनें:",
    choose_category: "<b>चरण 2/6:</b> विशिष्ट श्रेणी चुनें:",
    choose_issue: "<b>चरण 3/6:</b> समस्या का प्रकार चुनें:",
    other_option: "अन्य (स्वयं विवरण दें)",
    enter_description: "<b>चरण 4/6:</b> कृपया समस्या का संक्षिप्त विवरण लिखें (अधिकतम 500 अक्षर):",
    desc_too_long: "विवरण 500 अक्षरों से अधिक है। कृपया संक्षिप्त विवरण दें:",
    send_location:
      "<b>चरण 5/6:</b> कृपया समस्या का स्थान (GPS) भेजें या परीक्षण के लिए 'डिफ़ॉल्ट स्थान' चुनें:",
    location_received: "स्थान सफलतापूर्वक दर्ज किया गया।",
    send_photo: "<b>चरण 6/6:</b> कृपया समस्या का एक स्पष्ट फोटो खींचकर भेजें:",
    photo_received: "फोटो प्राप्त हुआ और सुरक्षित रूप से सहेजा गया।",
    send_voice: "<b>वैकल्पिक:</b> आप समस्या का संक्षिप्त ऑडियो संदेश भेज सकते हैं, या 'छोड़ें' पर टैप करें:",
    skip_voice: "ऑडियो संदेश छोड़ें",
    review_title: "<b>कृपया अपने विवरण की समीक्षा करें:</b>",
    confirm_btn: "पुष्टि करें और जमा करें",
    cancel_btn: "रद्द करें",
    report_submitted:
      "<b>शिकायत सफलतापूर्वक दर्ज की गई!</b>\n\nआपकी टिकट संख्या: <code>{ticket_code}</code>\n\nआपकी रिपोर्ट समीक्षा के लिए दर्ज कर दी गई है।",
    cancelled: "शिकायत रद्द कर दी गई। पुनः प्रारंभ करने के लिए /report टाइप करें।",
    help: "<b>नागरिक सहायता और गोपनीयता:</b>\n- आपकी रिपोर्ट गोपनीय रखी जाती है।\n- कमांड: /report, /language, /cancel, /help.",
    invalid_input: "अमान्य इनपुट। कृपया दिए गए बटनों का उपयोग करें या /cancel टाइप करें।",
  },
  mr: {
    welcome:
      "<b>नागरिक मध्ये आपले स्वागत आहे!</b>\nखारघर सेक्टर 4 साठी आपले नागरी तक्रार पोर्टल.\n\nतक्रार नोंदवण्यासाठी /report वापरा.\nभाषा बदलण्यासाठी /language वापरा.\nरद्द करण्यासाठी /cancel वापरा.",
    choose_language: "कृपया आपली भाषा निवडा:",
    choose_group: "<b>टप्पा 1/6:</b> समस्येचे मुख्य क्षेत्र निवडा:",
    choose_category: "<b>टप्पा 2/6:</b> वर्गवारी निवडा:",
    choose_issue: "<b>टप्पा 3/6:</b> समस्येचा प्रकार निवडा:",
    other_option: "इतर (स्वतः वर्णन करा)",
    enter_description: "<b>टप्पा 4/6:</b> कृपया समस्येचे संक्षिप्त वर्णन लिहा (कमाल 500 अक्षरे):",
    desc_too_long: "वर्णन 500 अक्षरांपेक्षा जास्त आहे. कृपया लहान वर्णन द्या:",
    send_location: "<b>टप्पा 5/6:</b> कृपया समस्येचे स्थान (GPS) पाठवा:",
    location_received: "स्थान यशस्वीरित्या नोंदवले गेले.",
    send_photo: "<b>टप्पा 6/6:</b> कृपया समस्येचा स्पष्ट फोटो पाठवा:",
    photo_received: "फोटो प्राप्त झाला आणि सुरक्षितपणे जतन केला गेला.",
    send_voice: "<b>पर्यायी:</b> आपण व्हॉइस मेसेज पाठवू शकता, किंवा 'वगळा' दाबा:",
    skip_voice: "व्हॉइस मेसेज वगळा",
    review_title: "<b>कृपया तक्रारीची पडताळणी करा:</b>",
    confirm_btn: "निश्चित करा आणि सादर करा",
    cancel_btn: "रद्द करा",
    report_submitted:
      "<b>तक्रार यशस्वीरित्या नोंदवली गेली!</b>\n\nआपला तिकीट क्रमांक: <code>{ticket_code}</code>\n\nआपली समस्या प्रशासकीय पडताळणीसाठी पाठवली गेली आहे.",
    cancelled: "तक्रार मसुदा रद्द केला. पुन्हा सुरू करण्यासाठी /report वापरा.",
    help: "<b>नागरिक सहाय्य व गोपनीयता:</b>\n- आपली तक्रार गोपनीय ठेवली जाते.\n- कमांड्स: /report, /language, /cancel, /help.",
    invalid_input: "अवैध इनपुट. कृपया दिलेल्या बटनांचा वापर करा किंवा /cancel दाबा.",
  },
};

export class TelegramConversationFSM {
  private bot: TelegramBotClient;
  private media: TelegramMediaService;

  constructor(bot?: TelegramBotClient, media?: TelegramMediaService) {
    this.bot = bot || new TelegramBotClient();
    this.media = media || new TelegramMediaService(this.bot);
  }

  /**
   * Processes an incoming Telegram update through the state machine.
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const supabase = createAdminSupabaseClient();

    // 1. Extract user & chat identity safely
    const message = update.message;
    const callback = update.callback_query;
    const user = message?.from || callback?.from;
    const chat = message?.chat || callback?.message?.chat;

    if (!user || !chat) {
      return;
    }

    const userHash = deriveCitizenUserHash(user.id);
    const encryptedChatId = encryptTelegramChatId(chat.id);

    // 2. Fetch current active draft and saved language
    const { data: draftRows } = await (supabase as any).rpc(
      "get_report_draft_by_hash",
      { p_telegram_user_hash: userHash }
    );

    const activeRow = draftRows && draftRows.length > 0 ? draftRows[0] : null;
    let language: SupportedLanguage =
      (activeRow?.language as SupportedLanguage) || "en";
    let state: ConversationState =
      (activeRow?.conversation_state as ConversationState) || "IDLE";
    let draftPayload: DraftPayload = activeRow?.draft_payload || {};

    // 3. Handle Global Commands
    const text = message?.text?.trim();

    if (text === "/start") {
      await this.sendLanguageSelection(chat.id);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", {}, language);
      return;
    }

    if (text === "/language") {
      await this.sendLanguageSelection(chat.id);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draftPayload, language);
      return;
    }

    if (text === "/cancel" || callback?.data === "action_cancel") {
      await (supabase as any).rpc("clear_report_draft_by_hash", {
        p_telegram_user_hash: userHash,
      });
      if (callback) {
        await this.bot.answerCallbackQuery(callback.id, "Cancelled");
      }
      await this.bot.sendMessage(chat.id, MESSAGES[language].cancelled);
      return;
    }

    if (text === "/help") {
      await this.bot.sendMessage(chat.id, MESSAGES[language].help);
      return;
    }

    if (text === "/report") {
      draftPayload = { language };
      await this.sendGroupSelection(chat.id, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_GROUP", draftPayload, language);
      return;
    }

    // 4. Handle State Machine Transitions based on callback queries or messages
    if (callback) {
      await this.handleCallback(
        callback,
        userHash,
        encryptedChatId,
        state,
        draftPayload,
        language
      );
      return;
    }

    if (message) {
      await this.handleMessage(
        message,
        userHash,
        encryptedChatId,
        state,
        draftPayload,
        language,
        update.update_id
      );
    }
  }

  /**
   * Handles button click callbacks
   */
  private async handleCallback(
    callback: TelegramCallbackQuery,
    userHash: string,
    encryptedChatId: string,
    state: ConversationState,
    draft: DraftPayload,
    language: SupportedLanguage
  ): Promise<void> {
    const data = callback.data || "";
    const chatId = callback.message?.chat.id;
    if (!chatId) return;

    await this.bot.answerCallbackQuery(callback.id);

    // Language selection callback
    if (data.startsWith("lang_")) {
      const selectedLang = data.replace("lang_", "") as SupportedLanguage;
      if (["en", "hi", "mr"].includes(selectedLang)) {
        language = selectedLang;
        draft.language = language;
        await this.bot.sendMessage(chatId, MESSAGES[language].welcome);
        await this.persistState(userHash, encryptedChatId, "IDLE", draft, language);
      }
      return;
    }

    // Group selection callback
    if (data.startsWith("group_")) {
      const groupId = data.replace("group_", "");
      const group = getTaxonomyGroup(groupId);
      if (group) {
        draft.groupId = groupId;
        await this.sendCategorySelection(chatId, group, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_CATEGORY", draft, language);
      }
      return;
    }

    // Category selection callback
    if (data.startsWith("cat_")) {
      const categoryId = data.replace("cat_", "");
      const category = getTaxonomyCategory(draft.groupId || "", categoryId);
      if (category) {
        draft.categoryId = categoryId;
        await this.sendIssueSelection(chatId, category, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draft, language);
      }
      return;
    }

    // Issue selection callback
    if (data.startsWith("issue_")) {
      const issueTypeId = data.replace("issue_", "");
      draft.issueTypeId = issueTypeId;
      await this.bot.sendMessage(chatId, MESSAGES[language].enter_description);
      await this.persistState(userHash, encryptedChatId, "AWAITING_DESCRIPTION", draft, language);
      return;
    }

    // Skip voice note callback
    if (data === "action_skip_voice") {
      await this.sendReviewSummary(chatId, draft, language);
      await this.persistState(userHash, encryptedChatId, "CONFIRM_SUBMISSION", draft, language);
      return;
    }

    // Confirm submission callback
    if (data === "action_confirm_submit") {
      await this.submitReport(chatId, userHash, encryptedChatId, draft, language, null);
    }
  }

  /**
   * Handles user text, photo, voice, and location messages
   */
  private async handleMessage(
    message: TelegramMessage,
    userHash: string,
    encryptedChatId: string,
    state: ConversationState,
    draft: DraftPayload,
    language: SupportedLanguage,
    updateId: number
  ): Promise<void> {
    const chatId = message.chat.id;

    switch (state) {
      case "AWAITING_DESCRIPTION": {
        const text = message.text?.trim() || "";
        if (!text) {
          await this.bot.sendMessage(chatId, MESSAGES[language].enter_description);
          return;
        }
        if (text.length > 500) {
          await this.bot.sendMessage(chatId, MESSAGES[language].desc_too_long);
          return;
        }

        draft.description = text;
        await this.sendLocationPrompt(chatId, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_LOCATION", draft, language);
        break;
      }

      case "AWAITING_LOCATION": {
        if (message.location) {
          draft.latitude = message.location.latitude;
          draft.longitude = message.location.longitude;
          draft.horizontalAccuracyM = message.location.horizontal_accuracy || 5.0;
          draft.locationSource = "telegram_location";
        } else {
          // Manual or text location fallback (or test mode pilot coordinates)
          draft.latitude = PILOT_CONFIG.centreLatitude;
          draft.longitude = PILOT_CONFIG.centreLongitude;
          draft.horizontalAccuracyM = 10.0;
          draft.locationSource = "landmark";
        }

        await this.bot.sendMessage(chatId, MESSAGES[language].location_received);
        await this.bot.sendMessage(chatId, MESSAGES[language].send_photo);
        await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
        break;
      }

      case "AWAITING_PHOTO": {
        if (!message.photo || message.photo.length === 0) {
          await this.bot.sendMessage(chatId, MESSAGES[language].send_photo);
          return;
        }

        // Take the highest resolution photo from the array
        const bestPhoto = message.photo[message.photo.length - 1];
        try {
          const processed = await this.media.processPhoto(
            bestPhoto.file_id,
            bestPhoto.file_unique_id,
            userHash.slice(0, 12)
          );

          draft.photoStoragePath = processed.storagePathPrivate;
          draft.photoMimeType = processed.mimeType;
          draft.photoSizeBytes = processed.fileSizeBytes;
          draft.photoSha256 = processed.sha256;
          draft.photoFileUniqueId = processed.telegramFileUniqueId;

          await this.bot.sendMessage(chatId, MESSAGES[language].photo_received);
          await this.sendVoicePrompt(chatId, language);
          await this.persistState(userHash, encryptedChatId, "AWAITING_VOICE", draft, language);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Error processing photo";
          await this.bot.sendMessage(chatId, `⚠️ ${errMsg}\nPlease send a valid photograph:`);
        }
        break;
      }

      case "AWAITING_VOICE": {
        if (message.voice) {
          try {
            const processed = await this.media.processVoice(
              message.voice.file_id,
              message.voice.file_unique_id,
              userHash.slice(0, 12)
            );

            draft.voiceStoragePath = processed.storagePathPrivate;
            draft.voiceSizeBytes = processed.fileSizeBytes;
            draft.voiceSha256 = processed.sha256;
            draft.voiceFileUniqueId = processed.telegramFileUniqueId;
          } catch (err) {
            console.warn("Voice processing error:", err);
          }
        }

        await this.sendReviewSummary(chatId, draft, language);
        await this.persistState(userHash, encryptedChatId, "CONFIRM_SUBMISSION", draft, language);
        break;
      }

      default: {
        await this.bot.sendMessage(chatId, MESSAGES[language].invalid_input);
        break;
      }
    }
  }

  /**
   * Submits the completed draft into PostgreSQL using create_report_submission.
   */
  private async submitReport(
    chatId: number,
    userHash: string,
    encryptedChatId: string,
    draft: DraftPayload,
    language: SupportedLanguage,
    updateId: number | null
  ): Promise<void> {
    const supabase = createAdminSupabaseClient();

    try {
      const { data, error } = await (supabase as any).rpc("create_report_submission", {
        p_telegram_user_hash: userHash,
        p_encrypted_chat_id: encryptedChatId,
        p_language: language,
        p_pilot_id: PILOT_CONFIG.id,
        p_group_id: draft.groupId,
        p_category_id: draft.categoryId,
        p_issue_type_id: draft.issueTypeId,
        p_description_private: draft.description || "Civic report submitted via Telegram",
        p_latitude: draft.latitude || PILOT_CONFIG.centreLatitude,
        p_longitude: draft.longitude || PILOT_CONFIG.centreLongitude,
        p_horizontal_accuracy_m: draft.horizontalAccuracyM || 5.0,
        p_location_source: draft.locationSource || "telegram_location",
        p_storage_path_private: draft.photoStoragePath || null,
        p_mime_type: draft.photoMimeType || "image/jpeg",
        p_file_size_bytes: draft.photoSizeBytes || 1024,
        p_sha256: draft.photoSha256 || "0000000000000000000000000000000000000000000000000000000000000000",
        p_telegram_file_unique_id: draft.photoFileUniqueId || null,
        p_telegram_update_id: updateId,
        p_is_demo: false,
      });

      if (error) {
        throw new Error(error.message);
      }

      const ticketCode = data?.ticket_code || "NAG-KHR-PENDING";
      const successMsg = MESSAGES[language].report_submitted.replace(
        "{ticket_code}",
        ticketCode
      );

      await this.bot.sendMessage(chatId, successMsg);
    } catch (err) {
      console.error("Submission failed:", err);
      await this.bot.sendMessage(
        chatId,
        "⚠️ Failed to record submission in civic database. Please try again with /report."
      );
    }
  }

  // ==========================================================================
  // Helper UI methods
  // ==========================================================================

  private async sendLanguageSelection(chatId: number): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "lang_en" },
          { text: "🇮🇳 हिंदी (Hindi)", callback_data: "lang_hi" },
          { text: "🇮🇳 मराठी (Marathi)", callback_data: "lang_mr" },
        ],
      ],
    };
    await this.bot.sendMessage(chatId, "<b>Language / भाषा / भाषा निवडा:</b>", keyboard);
  }

  private async sendGroupSelection(chatId: number, lang: SupportedLanguage): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: NAGRIK_TAXONOMY_V1.map((g) => [
        {
          text: getResolvedLabel(g.label, lang),
          callback_data: `group_${g.groupId}`,
        },
      ]),
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_group, keyboard);
  }

  private async sendCategorySelection(
    chatId: number,
    group: any,
    lang: SupportedLanguage
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: group.categories.map((c: any) => [
        {
          text: getResolvedLabel(c.label, lang),
          callback_data: `cat_${c.categoryId}`,
        },
      ]),
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_category, keyboard);
  }

  private async sendIssueSelection(
    chatId: number,
    category: any,
    lang: SupportedLanguage
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: category.options.map((o: any) => [
        {
          text: getResolvedLabel(o.label, lang),
          callback_data: `issue_${o.issueTypeId}`,
        },
      ]),
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_issue, keyboard);
  }

  private async sendLocationPrompt(chatId: number, lang: SupportedLanguage): Promise<void> {
    const keyboard = {
      keyboard: [
        [{ text: "📍 Share Current Location", request_location: true }],
        [{ text: "📍 Use Pilot Area Default (Sector 4 Kharghar)" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].send_location, keyboard);
  }

  private async sendVoicePrompt(chatId: number, lang: SupportedLanguage): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: `⏩ ${MESSAGES[lang].skip_voice}`, callback_data: "action_skip_voice" }],
      ],
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].send_voice, keyboard);
  }

  private async sendReviewSummary(
    chatId: number,
    draft: DraftPayload,
    lang: SupportedLanguage
  ): Promise<void> {
    const category = getTaxonomyCategory(draft.groupId || "", draft.categoryId || "");
    const option = getTaxonomyIssueOption(
      draft.groupId || "",
      draft.categoryId || "",
      draft.issueTypeId || ""
    );

    const categoryName = category ? getResolvedLabel(category.label, lang) : draft.categoryId;
    const issueName = option ? getResolvedLabel(option.label, lang) : draft.issueTypeId;

    const summaryText =
      `${MESSAGES[lang].review_title}\n\n` +
      `<b>Domain:</b> ${draft.groupId}\n` +
      `<b>Category:</b> ${categoryName}\n` +
      `<b>Issue:</b> ${issueName}\n` +
      `<b>Description:</b> ${draft.description || "N/A"}\n` +
      `<b>Location:</b> ${draft.latitude?.toFixed(4)}, ${draft.longitude?.toFixed(4)}\n` +
      `<b>Photo Evidence:</b> ${draft.photoStoragePath ? "Attached ✅" : "None"}\n` +
      `<b>Voice Note:</b> ${draft.voiceStoragePath ? "Attached ✅" : "None"}\n`;

    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: `✅ ${MESSAGES[lang].confirm_btn}`, callback_data: "action_confirm_submit" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };

    await this.bot.sendMessage(chatId, summaryText, keyboard);
  }

  private async persistState(
    userHash: string,
    encryptedChatId: string,
    state: ConversationState,
    payload: DraftPayload,
    lang: SupportedLanguage
  ): Promise<void> {
    const supabase = createAdminSupabaseClient();
    await (supabase as any).rpc("upsert_report_draft", {
      p_telegram_user_hash: userHash,
      p_encrypted_chat_id: encryptedChatId,
      p_conversation_state: state,
      p_draft_payload: payload,
      p_language: lang,
      p_ttl_hours: 48,
    });
  }
}
