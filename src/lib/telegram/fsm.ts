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
import { resolveJurisdiction } from "@/lib/geo/kharghar-jurisdiction";
import { TelegramBotClient } from "./bot";
import { TelegramMediaService } from "./media";
import { deriveCitizenUserHash, encryptTelegramChatId } from "./crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  validateReportPhotoWithOpenAI,
  transcribeVoiceWithOpenAI,
} from "@/lib/ai/openai-client";
import {
  getCitizenByTelegramHash,
  registerCitizen,
  verifyCitizenPassword,
  getCitizenTickets,
} from "@/lib/auth/citizen-store";
import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  ConversationState,
  DraftPayload,
  TelegramInlineKeyboardMarkup,
  TelegramReplyKeyboardMarkup,
} from "./types";

export function getMainMenuKeyboard(): TelegramReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "📝 Report Civic Issue" }, { text: "🎫 Track My Tickets" }],
      [{ text: "👮 Ward Police Directory" }, { text: "🌐 Change Language" }],
      [{ text: "🔒 Lock Session" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function getMainMenuInlineKeyboard(lang: SupportedLanguage = "en"): TelegramInlineKeyboardMarkup {
  const labels = {
    en: {
      report: "📝 Report Civic Issue",
      track: "🎫 Track My Tickets",
      police: "👮 Ward Police Directory",
      lang: "🌐 Change Language",
      lock: "🔒 Lock Session",
    },
    hi: {
      report: "📝 नागरिक शिकायत दर्ज करें",
      track: "🎫 मेरी शिकायतें देखें",
      police: "👮 वॉर्ड पुलिस डायरेक्टरी",
      lang: "🌐 भाषा बदलें",
      lock: "🔒 सत्र लॉक करें",
    },
    mr: {
      report: "📝 नागरी तक्रार नोंदवा",
      track: "🎫 माझ्या तक्रारी तपासा",
      police: "👮 वॉर्ड पोलीस माहिती",
      lang: "🌐 भाषा बदला",
      lock: "🔒 सत्र लॉक करा",
    },
  }[lang] || {
    report: "📝 Report Civic Issue",
    track: "🎫 Track My Tickets",
    police: "👮 Ward Police Directory",
    lang: "🌐 Change Language",
    lock: "🔒 Lock Session",
  };

  return {
    inline_keyboard: [
      [
        { text: labels.report, callback_data: "action_report" },
        { text: labels.track, callback_data: "action_track" },
      ],
      [
        { text: labels.police, callback_data: "action_police_dir" },
        { text: labels.lang, callback_data: "action_language" },
      ],
      [
        { text: labels.lock, callback_data: "action_lock" },
      ],
    ],
  };
}

export function renderTelegramSkeletonLoader(
  title: string,
  subtitle: string,
  progress: number = 2
): string {
  const bars = [
    "<code>[ ■■■□□□□□□□□□ ] 25%</code>",
    "<code>[ ■■■■■■□□□□□□ ] 50%</code>",
    "<code>[ ■■■■■■■■■□□□ ] 75%</code>",
    "<code>[ ■■■■■■■■■■■□ ] 95%</code>",
  ];
  const bar = bars[progress - 1] || bars[1];

  return [
    `⏳ <b>${title}</b>`,
    bar,
    `<i>${subtitle}</i>`,
    `<code>▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒</code>`,
  ].join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Localized bot interface strings
 */
const MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    welcome:
      "<b>Welcome to Nagrik!</b>\nYour civic intelligence and grievance portal for Kharghar Sector 4.\n\n👇 <b>Tap an option below to get started:</b>",
    choose_language: "Please choose your preferred language:",
    choose_problem: "📝 <b>Step 1 of 4: What's the problem?</b>\nTap the closest match.",
    other_problem: "Something else…",
    heard_transcript: "🎧 I heard: <i>“{transcript}”</i>",
    noted_description: "📝 Noted.",
    photo_ok: "📷 Photo received.",
    btn_share_location: "📍 Send my location",
    btn_cancel_report: "❌ Cancel Report",
    choose_group: "Which area is it in?",
    choose_category: "Which kind of problem?",
    choose_issue: "Pick the closest match:",
    other_option: "Other (Describe yourself)",
    send_voice_desc:
      "🎤 <b>Step 2 of 4: Describe it in a voice note.</b>\nSpeak in English, Hindi or Marathi, or tap <b>Type instead</b>.",
    btn_type_instead: "⌨️ Type instead",
    enter_description:
      "Please enter a short description of the issue (up to 500 characters):",
    desc_too_long: "Description exceeds 500 characters. Please provide a shorter description:",
    transcribing_voice: "🔄 <i>Transcribing your voice note...</i>",
    transcript_review: "📝 <b>Transcript:</b>\n\"{transcript}\"\n\nIs this description accurate?",
    btn_use_transcript: "✅ Use this description",
    btn_record_again: "🔄 Record again",
    btn_edit_transcript: "⌨️ Edit / Type text",
    transcription_failed:
      "⚠️ Could not transcribe the voice note clearly. Please record again or type:",
    send_location:
      "📍 <b>Step 4 of 4: Where is it?</b>\nTap <b>Send my location</b> below. Your phone shares where you are right now, nothing to upload.\n\n<i>On a computer? Type the street name or a nearby landmark instead.</i>",
    location_received: "Location recorded successfully.",
    location_out_of_bounds:
      "⚠️ That location is {dist} m from Kharghar center. Nagrik currently covers {radius} m across Kharghar City.\nIf the problem is inside Kharghar, send its location again, choose a quick button, or type a nearby landmark.",
    send_photo:
      "📷 <b>Step 3 of 4: Send a photo of the problem.</b>\nOne clear photo is enough.",
    photo_validating: "🔍 <i>Analyzing photo against selected issue...</i>",
    photo_received: "Photograph verified and securely stored.",
    photo_mismatch:
      "⚠️ <b>Photo Mismatch:</b>\nThis photo does not appear to show <b>{issue}</b>.\n<i>Reason: {reason}</i>\n\nPlease send another photo or change the issue type:",
    photo_unclear:
      "⚠️ <b>Photo Unclear:</b>\nThe photo is too blurry, dark, or lacks detail to verify <b>{issue}</b>.\n<i>Reason: {reason}</i>\n\nPlease take and send a clearer photograph:",
    btn_retry_photo: "📷 Send another photo",
    btn_change_issue: "🏷️ Change issue type",
    review_title: "<b>Please Review Your Report:</b>",
    confirm_btn: "Confirm & Submit",
    cancel_btn: "Cancel",
    report_submitted:
      "<b>Report Submitted Successfully!</b>\n\nYour Ticket Reference: <code>{ticket_code}</code>\n\nYour issue has been recorded in the civic grievance queue for verification. You can track this ticket anytime using the buttons below.",
    cancelled: "Report draft cancelled. Tap a button below to get started:",
    help: "<b>Nagrik Help & Privacy:</b>\n- Voice-first reporting: Speak to report issues.\n- Your reports are pseudonymous; personal identifiers are never stored.\n- Municipal authorities receive verified issues for physical repair.\n\n👇 <b>Use the buttons below to navigate:</b>",
    invalid_input: "Please use the buttons provided below:",
  },
  hi: {
    welcome:
      "<b>नागरिक में आपका स्वागत है!</b>\nखारघर सेक्टर 4 के लिए आपका नागरिक पोर्टल।\n\n👇 <b>शुरू करने के लिए नीचे दिए गए बटन पर टैप करें:</b>",
    choose_language: "कृपया अपनी पसंदीदा भाषा चुनें:",
    choose_problem: "📝 <b>चरण 1/4: समस्या क्या है?</b>\nसबसे मिलती-जुलती समस्या पर टैप करें।",
    other_problem: "कुछ और…",
    heard_transcript: "🎧 मैंने सुना: <i>“{transcript}”</i>",
    noted_description: "📝 दर्ज कर लिया।",
    photo_ok: "📷 फोटो मिल गया।",
    btn_share_location: "📍 मेरा स्थान भेजें",
    btn_cancel_report: "❌ रद्द करें",
    choose_group: "यह किस क्षेत्र की समस्या है?",
    choose_category: "किस तरह की समस्या है?",
    choose_issue: "सबसे मिलता-जुलता विकल्प चुनें:",
    other_option: "अन्य (स्वयं विवरण दें)",
    send_voice_desc:
      "🎤 <b>चरण 2/4: वॉइस नोट में समस्या बताएं।</b>\nहिंदी, मराठी या अंग्रेज़ी में बोलें, या <b>टाइप करें</b> दबाएं।",
    btn_type_instead: "⌨️ टाइप करें",
    enter_description: "कृपया समस्या का संक्षिप्त विवरण लिखें (अधिकतम 500 अक्षर):",
    desc_too_long: "विवरण 500 अक्षरों से अधिक है। कृपया संक्षिप्त विवरण दें:",
    transcribing_voice: "🔄 <i>ऑडियो का ट्रांसक्रिप्शन किया जा रहा है...</i>",
    transcript_review: "📝 <b>अनुवाद / ट्रांसक्रिप्ट:</b>\n\"{transcript}\"\n\nक्या यह विवरण सही है?",
    btn_use_transcript: "✅ इस विवरण का उपयोग करें",
    btn_record_again: "🔄 दोबारा रिकॉर्ड करें",
    btn_edit_transcript: "⌨️ संपादित करें / टाइप करें",
    transcription_failed:
      "⚠️ ऑडियो स्पष्ट रूप से समझ नहीं आया। कृपया दोबारा रिकॉर्ड करें या टाइप करें:",
    send_location:
      "📍 <b>चरण 4/4: समस्या कहाँ है?</b>\nनीचे <b>मेरा स्थान भेजें</b> दबाएं। आपका फ़ोन अभी का स्थान भेज देगा, कुछ अपलोड नहीं करना है।\n\n<i>कंप्यूटर पर हैं? गली का नाम या पास का कोई लैंडमार्क लिखें।</i>",
    location_received: "स्थान सफलतापूर्वक दर्ज किया गया।",
    location_out_of_bounds:
      "⚠️ यह स्थान खारघर केंद्र से {dist} मी दूर है। नागरिक अभी पूरे खारघर शहर में {radius} मी दायरे में काम करता है।\nअगर समस्या खारघर में है, तो स्थान दोबारा भेजें, शहर बटन चुनें, या पास का लैंडमार्क लिखें।",
    send_photo: "📷 <b>चरण 3/4: समस्या का फोटो भेजें।</b>\nएक साफ़ फोटो काफ़ी है।",
    photo_validating: "🔍 <i>फोटो की जांच की जा रही है...</i>",
    photo_received: "फोटो सत्यापित हुआ और सुरक्षित रूप से सहेजा गया।",
    photo_mismatch:
      "⚠️ <b>फोटो मेल नहीं खाता:</b>\nयह फोटो <b>{issue}</b> से मेल नहीं खाता है।\n<i>कारण: {reason}</i>\n\nकृपया दूसरा फोटो भेजें या समस्या का प्रकार बदलें:",
    photo_unclear:
      "⚠️ <b>फोटो स्पष्ट नहीं है:</b>\nफोटो धुंधला या अंधेरा है।\n<i>कारण: {reason}</i>\n\nकृपया एक स्पष्ट फोटो खींचकर भेजें:",
    btn_retry_photo: "📷 दूसरा फोटो भेजें",
    btn_change_issue: "🏷️ समस्या का प्रकार बदलें",
    review_title: "<b>कृपया अपने विवरण की समीक्षा करें:</b>",
    confirm_btn: "पुष्टि करें और जमा करें",
    cancel_btn: "रद्द करें",
    report_submitted:
      "<b>शिकायत सफलतापूर्वक दर्ज की गई!</b>\n\nआपकी टिकट संख्या: <code>{ticket_code}</code>\n\nआपकी रिपोर्ट समीक्षा के लिए दर्ज कर दी गई है।",
    cancelled: "शिकायत रद्द कर दी गई। पुनः प्रारंभ करने के लिए नीचे दिए गए बटन पर टैप करें।",
    help: "<b>नागरिक सहायता और गोपनीयता:</b>\n- वॉइस-फर्स्ट रिपोर्टिंग: बोलकर शिकायत दर्ज करें।\n- आपकी रिपोर्ट गोपनीय रखी जाती है।\n\n👇 <b>नीचे दिए गए बटनों का उपयोग करें:</b>",
    invalid_input: "कृपया नीचे दिए गए बटनों का उपयोग करें:",
  },
  mr: {
    welcome:
      "<b>नागरिक मध्ये आपले स्वागत आहे!</b>\nखारघर सेक्टर 4 साठी आपले नागरी तक्रार पोर्टल.\n\n👇 <b>सुरू करण्यासाठी खालील बटणावर टॅप करा:</b>",
    choose_language: "कृपया आपली भाषा निवडा:",
    choose_problem: "📝 <b>टप्पा 1/4: समस्या काय आहे?</b>\nसर्वात जवळच्या पर्यायावर टॅप करा.",
    other_problem: "आणखी काही…",
    heard_transcript: "🎧 मी ऐकले: <i>“{transcript}”</i>",
    noted_description: "📝 नोंद केली.",
    photo_ok: "📷 फोटो मिळाला.",
    btn_share_location: "📍 माझे स्थान पाठवा",
    btn_cancel_report: "❌ रद्द करा",
    choose_group: "ही समस्या कोणत्या क्षेत्रातील आहे?",
    choose_category: "कोणत्या प्रकारची समस्या आहे?",
    choose_issue: "सर्वात जवळचा पर्याय निवडा:",
    other_option: "इतर (स्वतः वर्णन करा)",
    send_voice_desc:
      "🎤 <b>टप्पा 2/4: व्हॉइस मेसेजमध्ये समस्या सांगा.</b>\nमराठी, हिंदी किंवा इंग्रजीत बोला, किंवा <b>टाइप करा</b> दाबा.",
    btn_type_instead: "⌨️ टाइप करा",
    enter_description: "कृपया समस्येचे संक्षिप्त वर्णन लिहा (कमाल 500 अक्षरे):",
    desc_too_long: "वर्णन 500 अक्षरांपेक्षा जास्त आहे. कृपया लहान वर्णन द्या:",
    transcribing_voice: "🔄 <i>व्हॉइस मेसेजचे लिप्यंतरण होत आहे...</i>",
    transcript_review: "📝 <b>लिप्यंतरण:</b>\n\"{transcript}\"\n\nहे वर्णन बरोबर आहे का?",
    btn_use_transcript: "✅ हे वर्णन वापरा",
    btn_record_again: "🔄 पुन्हा रेकॉर्ड करा",
    btn_edit_transcript: "⌨️ संपादित करा / टाइप करा",
    transcription_failed:
      "⚠️ व्हॉइस मेसेज स्पष्टपणे समजला नाही. कृपया पुन्हा रेकॉर्ड करा किंवा टाइप करा:",
    send_location: "📍 <b>टप्पा 4/4: समस्या कुठे आहे?</b>\nखाली <b>माझे स्थान पाठवा</b> दाबा. तुमचा फोन आत्ताचे स्थान पाठवेल, काहीही अपलोड करायचे नाही.\n\n<i>संगणकावर आहात? रस्त्याचे नाव किंवा जवळची खूण लिहा.</i>",
    location_received: "स्थान यशस्वीरित्या नोंदवले गेले.",
    location_out_of_bounds:
      "⚠️ हे स्थान खारघर केंद्रापासून {dist} मी दूर आहे. नागरिक सध्या संपूर्ण खारघर शहरात {radius} मी परिसरात काम करते.\nसमस्या खारघरमध्ये असल्यास, स्थान पुन्हा पाठवा, बटण निवडा किंवा जवळची खूण लिहा.",
    send_photo: "📷 <b>टप्पा 3/4: समस्येचा फोटो पाठवा.</b>\nएक स्पष्ट फोटो पुरेसा आहे.",
    photo_validating: "🔍 <i>फोटोची पडताळणी केली जात आहे...</i>",
    photo_received: "फोटो सत्यापित झाला आणि सुरक्षितपणे जतन केला गेला.",
    photo_mismatch:
      "⚠️ <b>फोटो जुळत नाही:</b>\nहा फोटो <b>{issue}</b> दर्शवत नाही.\n<i>कारण: {reason}</i>\n\nकृपया दुसरा फोटो पाठवा किंवा समस्येचा प्रकार बदला:",
    photo_unclear:
      "⚠️ <b>फोटो अस्पष्ट आहे:</b>\nफोटो अस्पष्ट किंवा अंधारातील आहे.\n<i>कारण: {reason}</i>\n\nकृपया स्पष्ट फोटो पाठवा:",
    btn_retry_photo: "📷 दुसरा फोटो पाठवा",
    btn_change_issue: "🏷️ समस्येचा प्रकार बदला",
    review_title: "<b>कृपया तक्रारीची पडताळणी करा:</b>",
    confirm_btn: "निश्चित करा आणि सादर करा",
    cancel_btn: "रद्द करा",
    report_submitted:
      "<b>तक्रार यशस्वीरित्या नोंदवली गेली!</b>\n\nआपला तिकीट क्रमांक: <code>{ticket_code}</code>\n\nआपली समस्या प्रशासकीय पडताळणीसाठी पाठवली गेली आहे.",
    cancelled: "तक्रार मसुदा रद्द केला. पुन्हा सुरू करण्यासाठी खालील बटण दाबा.",
    help: "<b>नागरिक सहाय्य व गोपनीयता:</b>\n- व्हॉइस-फर्स्ट तक्रार: बोलून तक्रार नोंदवा.\n- आपली तक्रार गोपनीय ठेवली जाते.\n\n👇 <b>खालील बटणे वापरा:</b>",
    invalid_input: "कृपया खालील बटणांचा वापर करा:",
  },
};

/**
 * One-tap problem menu: the most common civic problems, mapped to taxonomy IDs.
 * Labels come from the taxonomy, so they are already translated.
 * "Something else…" opens the full three-level menu.
 */
const QUICK_PROBLEMS: { groupId: string; categoryId: string; issueTypeId: string; emoji: string }[] = [
  { groupId: "waste_cleanliness_drainage", categoryId: "garbage_waste_collection", issueTypeId: "garbage_accumulation", emoji: "🗑️" },
  { groupId: "waste_cleanliness_drainage", categoryId: "garbage_waste_collection", issueTypeId: "overflowing_public_bin", emoji: "🚮" },
  { groupId: "roads_mobility", categoryId: "road_surface", issueTypeId: "pothole", emoji: "🕳️" },
  { groupId: "waste_cleanliness_drainage", categoryId: "drains_stormwater", issueTypeId: "blocked_drain", emoji: "🌊" },
  { groupId: "utilities_lighting_greenery", categoryId: "water_supply_public_taps", issueTypeId: "water_pipeline_leakage", emoji: "💧" },
  { groupId: "utilities_lighting_greenery", categoryId: "street_lighting_electrical", issueTypeId: "streetlight_not_working", emoji: "💡" },
  { groupId: "roads_mobility", categoryId: "footpaths_pedestrian", issueTypeId: "broken_missing_paving", emoji: "🚶" },
  { groupId: "roads_mobility", categoryId: "road_obstructions_open_works", issueTypeId: "damaged_missing_manhole", emoji: "⚠️" },
  { groupId: "utilities_lighting_greenery", categoryId: "trees_green_spaces", issueTypeId: "fallen_branch_tree", emoji: "🌳" },
];

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

    // Stop the button's loading spinner right away (answered exactly once).
    if (callback) {
      void this.bot.answerCallbackQuery(callback.id).catch(() => false);
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

    // 3. Citizen Registration & Session Gate
    const account = getCitizenByTelegramHash(userHash);
    const text = message?.text?.trim();

    // 3A. First-time citizen: Not registered yet
    if (!account) {
      if (state === "AWAITING_AUTH_NAME") {
        if (!text || text.startsWith("/") || text.length < 2) {
          await this.bot.sendMessage(
            chat.id,
            "Please enter your full name (e.g. Daksh Srivastava):"
          );
          return;
        }
        draftPayload.authNamePending = text;
        await this.bot.sendMessage(
          chat.id,
          `🔐 Welcome, <b>${escapeHtml(text)}</b>!\n\nPlease enter a <b>Password</b> (e.g. 1234):\n<i>You will need this password every time you use the bot, and to log into the Nagrik Web Portal to track tickets.</i>`
        );
        await this.persistState(
          userHash,
          encryptedChatId,
          "AWAITING_AUTH_PASSWORD",
          draftPayload,
          language
        );
        return;
      }

      if (state === "AWAITING_AUTH_PASSWORD") {
        if (!text || text.startsWith("/") || text.length < 2) {
          await this.bot.sendMessage(
            chat.id,
            "Please enter a valid password (at least 2 characters):"
          );
          return;
        }
        const citizenName = draftPayload.authNamePending || user.first_name || "Citizen";
        const newAccount = registerCitizen({
          name: citizenName,
          password: text,
          telegramUserHash: userHash,
          telegramUserId: user.id,
        });
        draftPayload.sessionUnlocked = true;
        delete draftPayload.authNamePending;
        await this.bot.sendMessage(
          chat.id,
          `🎉 <b>Registration Complete!</b>\n\n👤 <b>Name:</b> ${escapeHtml(newAccount.name)}\n🔑 <b>Password:</b> Saved securely\n\nYou can now log into the Nagrik Web Portal using this same name and password.`
        );
        await this.sendLanguageSelection(chat.id, false);
        await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draftPayload, language);
        return;
      }

      // Initial greeting asking for citizen name
      await this.bot.sendMessage(
        chat.id,
        "👋 <b>Welcome to Nagrik!</b>\nKharghar Sector 4 Civic Grievance Portal.\n\nTo begin reporting issues and tracking their repair, please enter your <b>Full Name</b>:\n<i>(This name will protect your civic reports and allow you to view your tickets on the web portal)</i>"
      );
      await this.persistState(userHash, encryptedChatId, "AWAITING_AUTH_NAME", {}, language);
      return;
    }

    // 3B. Registered citizen, but Session is Locked
    if (!draftPayload.sessionUnlocked) {
      if (state === "AWAITING_SESSION_PASSWORD") {
        const passAttempt = text || "";
        const verify = verifyCitizenPassword(account.normalizedName, passAttempt);
        if (!verify.success) {
          await this.bot.sendMessage(
            chat.id,
            "❌ <b>Incorrect password.</b> Please try again:"
          );
          return;
        }
        // Successfully verified
        draftPayload.sessionUnlocked = true;
        await this.bot.sendMessage(
          chat.id,
          `🔓 <b>Session Unlocked!</b>\n\nWelcome back, <b>${escapeHtml(account.name)}</b>! How can we help you in Kharghar Sector 4 today?\n\n👇 <b>Tap an option below:</b>`,
          getMainMenuInlineKeyboard(language)
        );
        await this.persistState(userHash, encryptedChatId, "IDLE", draftPayload, language);
        return;
      }

      // Prompt for password
      await this.bot.sendMessage(
        chat.id,
        `🔒 <b>Nagrik Bot Locked</b>\n\nWelcome back, <b>${escapeHtml(account.name)}</b>!\nPlease enter your <b>Password</b> to unlock:`
      );
      await this.persistState(
        userHash,
        encryptedChatId,
        "AWAITING_SESSION_PASSWORD",
        draftPayload,
        language
      );
      return;
    }

    // 3C. Authenticated & Session Unlocked: Handle Dedicated Menu Buttons & Commands
    if (
      text === "📝 Report Civic Issue" ||
      text === "📝 नागरिक शिकायत दर्ज करें" ||
      text === "📝 नागरी तक्रार नोंदवा" ||
      text === "/report" ||
      text === "/new"
    ) {
      // Ask for the language at the start of a report, unless it was just chosen.
      const recent = draftPayload.languageChosenAt && Date.now() - draftPayload.languageChosenAt < 15 * 60 * 1000;
      if (recent) {
        draftPayload = { language, sessionUnlocked: true, languageChosenAt: draftPayload.languageChosenAt };
        await this.sendQuickProblemMenu(chat.id, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draftPayload, language);
        return;
      }
      draftPayload = { language, sessionUnlocked: true, reportAfterLanguage: true };
      await this.sendLanguageSelection(chat.id, true);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draftPayload, language);
      return;
    }

    if (
      text === "👮 Ward Police Directory" ||
      text === "👮 वॉर्ड पुलिस डायरेक्टरी" ||
      text === "👮 वॉर्ड पोलीस माहिती" ||
      text === "/police" ||
      text?.toLowerCase() === "police"
    ) {
      await this.sendWardPoliceDirectory(chat.id, language);
      return;
    }

    if (text === "🎫 Track My Tickets" || text === "/tickets" || text === "/track") {
      void this.bot.sendChatAction(chat.id, "typing");
      const loaderMsg = await this.bot.sendMessage(
        chat.id,
        renderTelegramSkeletonLoader(
          "Loading Civic Tickets",
          "Connecting to Kharghar Sector 4 ledger...",
          2
        )
      );

      const tickets = await getCitizenTickets(account.name);
      if (tickets.length === 0) {
        const emptyMsg = "🎫 <b>No Active Reports Found</b>\n\nYou haven't submitted any civic defect reports yet.\n\nTap <b>📝 Report Civic Issue</b> below to report your first defect in Kharghar Sector 4!";
        const emptyKeyboard = {
          inline_keyboard: [
            [{ text: "📝 Report Civic Issue", callback_data: "action_report" }],
            [{ text: "🌐 Change Language", callback_data: "action_language" }],
          ],
        };
        if (loaderMsg?.message_id) {
          const edited = await this.bot.editMessageText(chat.id, loaderMsg.message_id, emptyMsg, emptyKeyboard);
          if (edited) return;
        }
        await this.bot.sendMessage(chat.id, emptyMsg, emptyKeyboard);
      } else {
        let msg = `🎫 <b>Your Civic Reports (${tickets.length}):</b>\n\n`;
        const topTickets = tickets.slice(0, 5);
        for (let i = 0; i < topTickets.length; i++) {
          const t = topTickets[i];
          const numEmoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][i] || "🔹";
          const dateStr = new Date(t.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          msg += `${numEmoji} <b>Ticket:</b> <code>${t.ticket_code}</code>\n`;
          msg += `📁 <b>Category:</b> ${t.category}\n`;
          msg += `📊 <b>Status:</b> ${t.status_label}\n`;
          if (t.description) {
            msg += `📝 <b>Description:</b> "${escapeHtml(t.description)}"\n`;
          }
          msg += `📅 <b>Reported:</b> ${dateStr}\n\n`;
        }
        msg += `🌐 <i>Log into the Nagrik Web Portal anytime with your name & password to view full resolution photos and repair verification!</i>`;
        const ticketsKeyboard = {
          inline_keyboard: [
            [
              { text: "📝 Report New Issue", callback_data: "action_report" },
              { text: "🔄 Refresh Tickets", callback_data: "action_track" },
            ],
          ],
        };
        if (loaderMsg?.message_id) {
          const edited = await this.bot.editMessageText(chat.id, loaderMsg.message_id, msg, ticketsKeyboard);
          if (edited) return;
        }
        await this.bot.sendMessage(chat.id, msg, ticketsKeyboard);
      }
      return;
    }

    if (text === "🌐 Change Language" || text === "/language") {
      delete draftPayload.reportAfterLanguage;
      await this.sendLanguageSelection(chat.id, false);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draftPayload, language);
      return;
    }

    if (text === "🔒 Lock Session" || text === "🔒 Lock Bot Session") {
      draftPayload.sessionUnlocked = false;
      await this.bot.sendMessage(
        chat.id,
        "🔒 <b>Session Locked</b>\n\nYour session has been locked for security. Enter your password anytime to unlock again."
      );
      await this.persistState(
        userHash,
        encryptedChatId,
        "AWAITING_SESSION_PASSWORD",
        draftPayload,
        language
      );
      return;
    }

    if (
      text === "❌ Cancel / Reset" ||
      text === "❌ Cancel Report" ||
      text === "❌ रद्द करें" ||
      text === "❌ रद्द करा" ||
      text === "❌ Cancel" ||
      text === "/cancel" ||
      callback?.data === "action_cancel"
    ) {
      await (supabase as any).rpc("clear_report_draft_by_hash", {
        p_telegram_user_hash: userHash,
      });
      draftPayload = { language, sessionUnlocked: true, languageChosenAt: draftPayload.languageChosenAt };
      await this.bot.sendMessage(
        chat.id,
        MESSAGES[language].cancelled,
        getMainMenuInlineKeyboard(language)
      );
      await this.persistState(userHash, encryptedChatId, "IDLE", draftPayload, language);
      return;
    }

    if (text === "/start") {
      // Begin every fresh conversation with language selection.
      draftPayload = { language, sessionUnlocked: true };
      await this.sendLanguageSelection(chat.id, false, `👋 Welcome back, <b>${escapeHtml(account.name)}</b>!\n\n`);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draftPayload, language);
      return;
    }

    if (text === "/help") {
      await this.bot.sendMessage(
        chat.id,
        MESSAGES[language].help,
        getMainMenuInlineKeyboard(language)
      );
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

    // (The callback was already answered in handleUpdate.)
    const msgId = callback.message?.message_id;

    // Language selection callback
    if (data.startsWith("lang_")) {
      const selectedLang = data.replace("lang_", "") as SupportedLanguage;
      if (["en", "hi", "mr"].includes(selectedLang)) {
        language = selectedLang;
        const langName = selectedLang === "en" ? "English" : selectedLang === "hi" ? "हिंदी" : "मराठी";

        if (draft.reportAfterLanguage) {
          // Fresh report draft in the newly chosen language; the picker becomes the problem menu.
          const fresh: DraftPayload = { language, sessionUnlocked: true, languageChosenAt: Date.now() };
          await this.sendQuickProblemMenu(chatId, language, msgId, `🌐 ${langName} ✅\n\n`);
          await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", fresh, language);
          return;
        }

        draft.language = language;
        draft.languageChosenAt = Date.now();
        delete draft.reportAfterLanguage;
        await this.show(
          chatId,
          msgId,
          `🌐 <b>${langName}</b>\n\n${MESSAGES[language].welcome}`,
          getMainMenuInlineKeyboard(language)
        );
        await this.persistState(userHash, encryptedChatId, "IDLE", draft, language);
      }
      return;
    }

    // Police Directory callback
    if (data === "action_police_dir" || data.startsWith("police_")) {
      await this.sendWardPoliceDirectory(chatId, language, msgId);
      return;
    }

    // Action: Report Civic Issue from inline button
    if (data === "action_report") {
      // Ask for the language at the start of a report, unless it was just chosen.
      const recent = draft.languageChosenAt && Date.now() - draft.languageChosenAt < 15 * 60 * 1000;
      if (recent) {
        draft = { language, sessionUnlocked: true, languageChosenAt: draft.languageChosenAt };
        await this.sendQuickProblemMenu(chatId, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draft, language);
        return;
      }
      draft = { language, sessionUnlocked: true, reportAfterLanguage: true };
      await this.sendLanguageSelection(chatId, true);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draft, language);
      return;
    }

    // Action: Track My Tickets from inline button
    if (data === "action_track") {
      void this.bot.sendChatAction(chatId, "typing");
      const loaderMsg = await this.bot.sendMessage(
        chatId,
        renderTelegramSkeletonLoader(
          "Loading Civic Tickets",
          "Connecting to Kharghar Sector 4 ledger...",
          2
        )
      );

      const account = getCitizenByTelegramHash(userHash);
      const citizenName = account ? account.name : "Citizen";
      const tickets = await getCitizenTickets(citizenName);
      if (tickets.length === 0) {
        const emptyMsg = "🎫 <b>No Active Reports Found</b>\n\nYou haven't submitted any civic defect reports yet.\n\nTap <b>📝 Report Civic Issue</b> below to report your first defect in Kharghar Sector 4!";
        const emptyKeyboard = {
          inline_keyboard: [
            [{ text: "📝 Report Civic Issue", callback_data: "action_report" }],
            [{ text: "🌐 Change Language", callback_data: "action_language" }],
          ],
        };
        if (loaderMsg?.message_id) {
          const edited = await this.bot.editMessageText(chatId, loaderMsg.message_id, emptyMsg, emptyKeyboard);
          if (edited) return;
        }
        await this.bot.sendMessage(chatId, emptyMsg, emptyKeyboard);
      } else {
        let msg = `🎫 <b>Your Civic Reports (${tickets.length}):</b>\n\n`;
        const topTickets = tickets.slice(0, 5);
        for (let i = 0; i < topTickets.length; i++) {
          const t = topTickets[i];
          const numEmoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][i] || "🔹";
          const dateStr = new Date(t.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          msg += `${numEmoji} <b>Ticket:</b> <code>${t.ticket_code}</code>\n`;
          msg += `📁 <b>Category:</b> ${t.category}\n`;
          msg += `📊 <b>Status:</b> ${t.status_label}\n`;
          if (t.description) {
            msg += `📝 <b>Description:</b> "${escapeHtml(t.description)}"\n`;
          }
          msg += `📅 <b>Reported:</b> ${dateStr}\n\n`;
        }
        msg += `🌐 <i>Log into the Nagrik Web Portal anytime with your name & password to view full resolution photos and repair verification!</i>`;
        const ticketsKeyboard = {
          inline_keyboard: [
            [
              { text: "📝 Report New Issue", callback_data: "action_report" },
              { text: "🔄 Refresh Tickets", callback_data: "action_track" },
            ],
          ],
        };
        if (loaderMsg?.message_id) {
          const edited = await this.bot.editMessageText(chatId, loaderMsg.message_id, msg, ticketsKeyboard);
          if (edited) return;
        }
        await this.bot.sendMessage(chatId, msg, ticketsKeyboard);
      }
      return;
    }

    // Action: Change Language from inline button
    if (data === "action_language") {
      delete draft.reportAfterLanguage;
      await this.sendLanguageSelection(chatId, false);
      await this.persistState(userHash, encryptedChatId, "AWAITING_LANGUAGE", draft, language);
      return;
    }

    // Action: Lock Session from inline button
    if (data === "action_lock") {
      draft.sessionUnlocked = false;
      await this.bot.sendMessage(
        chatId,
        "🔒 <b>Session Locked</b>\n\nYour session has been locked for security. Enter your password anytime to unlock again."
      );
      await this.persistState(
        userHash,
        encryptedChatId,
        "AWAITING_SESSION_PASSWORD",
        draft,
        language
      );
      return;
    }

    // Action: Cancel Report from inline button
    if (data === "action_cancel") {
      const supabase = createAdminSupabaseClient();
      await (supabase as any).rpc("clear_report_draft_by_hash", {
        p_telegram_user_hash: userHash,
      });
      draft = { language, sessionUnlocked: true, languageChosenAt: draft.languageChosenAt };
      await this.bot.sendMessage(
        chatId,
        MESSAGES[language].cancelled,
        getMainMenuInlineKeyboard(language)
      );
      await this.persistState(userHash, encryptedChatId, "IDLE", draft, language);
      return;
    }

    // Navigation: Back to Group Selection
    if (data === "action_back_group") {
      await this.sendGroupSelection(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_GROUP", draft, language);
      return;
    }

    // Navigation: Back to Category Selection
    if (data === "action_back_cat") {
      if (draft.groupId) {
        const group = getTaxonomyGroup(draft.groupId);
        if (group) {
          await this.sendCategorySelection(chatId, group, language);
          await this.persistState(userHash, encryptedChatId, "AWAITING_CATEGORY", draft, language);
          return;
        }
      }
      await this.sendGroupSelection(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_GROUP", draft, language);
      return;
    }

    // Navigation: Back to Issue Selection
    if (data === "action_back_issue") {
      if (draft.groupId && draft.categoryId) {
        const category = getTaxonomyCategory(draft.groupId, draft.categoryId);
        if (category) {
          await this.sendIssueSelection(chatId, category, language);
          await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draft, language);
          return;
        }
      }
      await this.sendGroupSelection(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_GROUP", draft, language);
      return;
    }

    // One-tap problem pick
    if (data.startsWith("qp_")) {
      if (data === "qp_other") {
        await this.sendGroupSelection(chatId, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_GROUP", draft, language);
        return;
      }
      const pick = QUICK_PROBLEMS[Number(data.replace("qp_", ""))];
      if (!pick) {
        await this.sendQuickProblemMenu(chatId, language);
        return;
      }
      draft.groupId = pick.groupId;
      draft.categoryId = pick.categoryId;
      draft.issueTypeId = pick.issueTypeId;
      // A new problem type needs a fresh photo check.
      draft.photoValidationStatus = undefined;
      draft.photoValidationReason = undefined;
      draft.validatedPhotoSha256 = undefined;
      draft.validatedIssueTypeId = undefined;
      const picked = getTaxonomyIssueOption(pick.groupId, pick.categoryId, pick.issueTypeId);
      const pickedLabel = picked ? getResolvedLabel(picked.label, language) : pick.issueTypeId;
      await this.sendVoiceDescriptionPrompt(chatId, language, msgId, `✅ ${pick.emoji} <b>${escapeHtml(pickedLabel)}</b>\n\n`);
      await this.persistState(userHash, encryptedChatId, "AWAITING_VOICE_DESCRIPTION", draft, language);
      return;
    }

    // Back to the one-tap problem menu
    if (data === "action_back_quick") {
      await this.sendQuickProblemMenu(chatId, language, msgId);
      await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draft, language);
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

    // Issue selection callback -> Enters VOICE-FIRST intake flow
    if (data.startsWith("issue_")) {
      const issueTypeId = data.replace("issue_", "");
      draft.issueTypeId = issueTypeId;

      // Revalidation required if issue type changes
      if (draft.validatedIssueTypeId && draft.validatedIssueTypeId !== issueTypeId) {
        draft.photoValidationStatus = undefined;
        draft.photoValidationReason = undefined;
        draft.validatedPhotoSha256 = undefined;
        draft.validatedIssueTypeId = undefined;
      }

      await this.sendVoiceDescriptionPrompt(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_VOICE_DESCRIPTION", draft, language);
      return;
    }

    // Fallback: citizen taps "Type instead"
    if (data === "action_type_desc") {
      await this.bot.sendMessage(chatId, MESSAGES[language].enter_description);
      await this.persistState(userHash, encryptedChatId, "AWAITING_DESCRIPTION", draft, language);
      return;
    }

    // Transcript confirmed by citizen: "Use this description"
    if (data === "action_use_transcript") {
      draft.description = draft.transcriptPending;
      draft.voiceTranscript = draft.transcriptPending;
      await this.sendPhotoPrompt(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
      return;
    }

    // Citizen chooses to re-record voice note
    if (data === "action_record_again") {
      draft.transcriptPending = undefined;
      await this.sendVoiceDescriptionPrompt(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_VOICE_DESCRIPTION", draft, language);
      return;
    }

    // Citizen chooses to edit transcript as text
    if (data === "action_edit_transcript") {
      await this.bot.sendMessage(chatId, MESSAGES[language].enter_description);
      await this.persistState(userHash, encryptedChatId, "AWAITING_DESCRIPTION", draft, language);
      return;
    }

    // Photo retry callback
    if (data === "action_retry_photo") {
      await this.sendPhotoPrompt(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
      return;
    }

    // Change issue type after photo mismatch
    if (data === "action_change_issue") {
      draft.photoValidationStatus = undefined;
      draft.photoValidationReason = undefined;
      draft.validatedPhotoSha256 = undefined;
      draft.validatedIssueTypeId = undefined;
      await this.sendQuickProblemMenu(chatId, language);
      await this.persistState(userHash, encryptedChatId, "AWAITING_ISSUE_TYPE", draft, language);
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
      case "AWAITING_LANGUAGE": {
        // User typed/sent something instead of tapping a language button.
        await this.sendLanguageSelection(chatId, Boolean(draft.reportAfterLanguage));
        return;
      }

      case "AWAITING_VOICE_DESCRIPTION": {
        // Voice-first intake
        if (message.voice) {
          try {
            void this.bot.sendChatAction(chatId, "record_voice");
            const loaderMsg = await this.bot.sendMessage(
              chatId,
              renderTelegramSkeletonLoader(
                "Transcribing Voice Note",
                "Converting citizen speech into verified transcript...",
                2
              )
            );

            const processed = await this.media.processVoice(
              message.voice.file_id,
              message.voice.file_unique_id,
              userHash.slice(0, 12)
            );

            draft.voiceStoragePath = processed.storagePathPrivate;
            draft.voiceSizeBytes = processed.fileSizeBytes;
            draft.voiceSha256 = processed.sha256;
            draft.voiceFileUniqueId = processed.telegramFileUniqueId;

            if (processed.buffer) {
              const category = getTaxonomyCategory(draft.groupId || "", draft.categoryId || "");
              const option = getTaxonomyIssueOption(
                draft.groupId || "",
                draft.categoryId || "",
                draft.issueTypeId || ""
              );
              const categoryName = category
                ? getResolvedLabel(category.label, language)
                : draft.categoryId;
              const issueName = option
                ? getResolvedLabel(option.label, language)
                : draft.issueTypeId;

              const res = await transcribeVoiceWithOpenAI({
                audioBuffer: processed.buffer,
                mimeType: processed.mimeType,
                language,
                categoryName,
                issueTypeName: issueName,
              });

              const transcript = res.transcript?.trim() || "";
              const isUsable =
                transcript.length > 0 &&
                !transcript.startsWith("[Transcription error") &&
                !transcript.startsWith("[Transcription disabled");

              if (isUsable) {
                // Accept the transcript straight away (no confirm step) and move on to the photo.
                draft.description = transcript.slice(0, 500);
                draft.voiceTranscript = transcript;
                draft.transcriptPending = undefined;
                const heard = MESSAGES[language].heard_transcript.replace("{transcript}", escapeHtml(transcript));
                let shown = false;
                if (loaderMsg?.message_id) {
                  shown = Boolean(await this.bot.editMessageText(chatId, loaderMsg.message_id, heard));
                }
                if (!shown) await this.bot.sendMessage(chatId, heard);
                await this.sendPhotoPrompt(chatId, language);
                await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
                return;
              }
            }

            // Fallback when transcription fails or returns empty text
            if (loaderMsg?.message_id) {
              await this.bot.deleteMessage(chatId, loaderMsg.message_id);
            }
            const keyboard: TelegramInlineKeyboardMarkup = {
              inline_keyboard: [
                [
                  { text: MESSAGES[language].btn_record_again, callback_data: "action_record_again" },
                  { text: MESSAGES[language].btn_type_instead, callback_data: "action_type_desc" },
                ],
              ],
            };
            await this.bot.sendMessage(chatId, MESSAGES[language].transcription_failed, keyboard);
            await this.persistState(
              userHash,
              encryptedChatId,
              "AWAITING_VOICE_DESCRIPTION",
              draft,
              language
            );
          } catch (err) {
            console.error("Voice intake error:", err);
            await this.sendVoiceDescriptionPrompt(chatId, language);
          }
          break;
        }

        // Optional text fallback if citizen types directly
        if (message.text) {
          const text = message.text.trim();
          if (text.length > 500) {
            await this.bot.sendMessage(chatId, MESSAGES[language].desc_too_long);
            return;
          }
          draft.description = text;
          await this.bot.sendMessage(chatId, MESSAGES[language].noted_description);
          await this.sendPhotoPrompt(chatId, language);
          await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
          break;
        }

        await this.sendVoiceDescriptionPrompt(chatId, language);
        break;
      }

      case "CONFIRM_VOICE_TRANSCRIPT": {
        // If citizen sends text edit directly
        if (message.text) {
          const text = message.text.trim();
          if (text.length > 500) {
            await this.bot.sendMessage(chatId, MESSAGES[language].desc_too_long);
            return;
          }
          draft.description = text;
          await this.bot.sendMessage(chatId, MESSAGES[language].noted_description);
          await this.sendPhotoPrompt(chatId, language);
          await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
          break;
        }

        if (draft.transcriptPending) {
          await this.sendTranscriptReview(chatId, draft.transcriptPending, language);
        }
        break;
      }

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
        await this.bot.sendMessage(chatId, MESSAGES[language].noted_description);
        await this.sendPhotoPrompt(chatId, language);
        await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO", draft, language);
        break;
      }

      case "AWAITING_LOCATION": {
        let lat = PILOT_CONFIG.centreLatitude;
        let lon = PILOT_CONFIG.centreLongitude;
        let accuracy = 10.0;
        let source: DraftPayload["locationSource"] = "landmark";

        const locText = message.text?.trim() || "";

        if (message.location) {
          // One tap on "Send my location": the phone's current GPS position.
          lat = message.location.latitude;
          lon = message.location.longitude;
          accuracy = message.location.horizontal_accuracy || 5.0;
          source = "telegram_location";
        } else if (locText && !locText.startsWith("/")) {
          if (locText.includes("ITM")) {
            lat = 19.0338;
            lon = 73.0630;
          }
          // Computers can't share GPS: accept a typed street or landmark.
          // It's kept with the report so the field team can find the spot.
          const landmark = locText.slice(0, 160);
          const base = (draft.description || "").trim();
          const note = `📍 ${landmark}`;
          draft.description = (base ? `${base}\n${note}` : note).slice(0, 500);
          source = "landmark";
        } else {
          await this.sendLocationPrompt(chatId, language);
          return;
        }

        // Apply Kharghar City geofence check (coverage radius: PILOT_CONFIG.radiusMetres)
        const dist = calculateHaversineDistanceMetres(
          lat,
          lon,
          PILOT_CONFIG.centreLatitude,
          PILOT_CONFIG.centreLongitude
        );

        if (dist > PILOT_CONFIG.radiusMetres) {
          const warning = MESSAGES[language].location_out_of_bounds
            .replace("{dist}", Math.round(dist).toString())
            .replace("{radius}", PILOT_CONFIG.radiusMetres.toString());
          await this.bot.sendMessage(chatId, warning);
          // Keep draft in AWAITING_LOCATION
          await this.persistState(userHash, encryptedChatId, "AWAITING_LOCATION", draft, language);
          return;
        }

        draft.latitude = lat;
        draft.longitude = lon;
        draft.horizontalAccuracyM = accuracy;
        draft.locationSource = source;

        // Location is the last step: submit straight away (no review screen).
        await this.submitReport(chatId, userHash, encryptedChatId, draft, language, updateId);
        break;
      }

      case "AWAITING_PHOTO":
      case "AWAITING_PHOTO_RETRY": {
        if (!message.photo || message.photo.length === 0) {
          await this.sendPhotoPrompt(chatId, language);
          return;
        }

        const bestPhoto = message.photo[message.photo.length - 1];
        try {
          void this.bot.sendChatAction(chatId, "upload_photo");
          const loaderMsg = await this.bot.sendMessage(
            chatId,
            renderTelegramSkeletonLoader(
              "Validating Photo Evidence",
              "Checking photo clarity & analyzing defect with AI Vision...",
              3
            )
          );

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

          // Get resolved taxonomy issue & category names
          const category = getTaxonomyCategory(draft.groupId || "", draft.categoryId || "");
          const option = getTaxonomyIssueOption(
            draft.groupId || "",
            draft.categoryId || "",
            draft.issueTypeId || ""
          );
          const categoryName = category
            ? getResolvedLabel(category.label, language)
            : draft.categoryId || "Civic Defect";
          const issueName = option
            ? getResolvedLabel(option.label, language)
            : draft.issueTypeId || "Civic Issue";

          // Validate photo with OpenAI Vision
          const valResult = await validateReportPhotoWithOpenAI({
            photoBuffer: processed.buffer,
            mimeType: processed.mimeType,
            categoryName,
            issueTypeName: issueName,
            description: draft.description,
          });

          // Tie validation result to exact photo sha256 and issueTypeId
          draft.photoValidationStatus = valResult.status;
          draft.photoValidationReason = valResult.reasoning;
          draft.validatedPhotoSha256 = processed.sha256;
          draft.validatedIssueTypeId = draft.issueTypeId;

          if (valResult.status === "MATCH" || valResult.status === "UNVERIFIED") {
            let shown = false;
            if (loaderMsg?.message_id) {
              shown = Boolean(await this.bot.editMessageText(chatId, loaderMsg.message_id, MESSAGES[language].photo_ok));
            }
            if (!shown) await this.bot.sendMessage(chatId, MESSAGES[language].photo_ok);
            await this.sendLocationPrompt(chatId, language);
            await this.persistState(userHash, encryptedChatId, "AWAITING_LOCATION", draft, language);
          } else if (valResult.status === "MISMATCH") {
            const mismatchMsg = MESSAGES[language].photo_mismatch
              .replace("{issue}", issueName)
              .replace("{reason}", valResult.reasoning);
            const keyboard: TelegramInlineKeyboardMarkup = {
              inline_keyboard: [
                [{ text: MESSAGES[language].btn_retry_photo, callback_data: "action_retry_photo" }],
                [{ text: MESSAGES[language].btn_change_issue, callback_data: "action_change_issue" }],
                [{ text: `❌ ${MESSAGES[language].cancel_btn}`, callback_data: "action_cancel" }],
              ],
            };
            if (loaderMsg?.message_id) {
              const edited = await this.bot.editMessageText(chatId, loaderMsg.message_id, mismatchMsg, keyboard);
              if (!edited) await this.bot.sendMessage(chatId, mismatchMsg, keyboard);
            } else {
              await this.bot.sendMessage(chatId, mismatchMsg, keyboard);
            }
            await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO_RETRY", draft, language);
          } else {
            // UNCLEAR
            const unclearMsg = MESSAGES[language].photo_unclear
              .replace("{issue}", issueName)
              .replace("{reason}", valResult.reasoning);
            const keyboard: TelegramInlineKeyboardMarkup = {
              inline_keyboard: [
                [{ text: MESSAGES[language].btn_retry_photo, callback_data: "action_retry_photo" }],
                [{ text: `❌ ${MESSAGES[language].cancel_btn}`, callback_data: "action_cancel" }],
              ],
            };
            if (loaderMsg?.message_id) {
              const edited = await this.bot.editMessageText(chatId, loaderMsg.message_id, unclearMsg, keyboard);
              if (!edited) await this.bot.sendMessage(chatId, unclearMsg, keyboard);
            } else {
              await this.bot.sendMessage(chatId, unclearMsg, keyboard);
            }
            await this.persistState(userHash, encryptedChatId, "AWAITING_PHOTO_RETRY", draft, language);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Error processing photo";
          await this.bot.sendMessage(chatId, `⚠️ ${errMsg}\nPlease send a valid photograph:`);
        }
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
   * Strictly enforces:
   * 1. Photographic evidence exists.
   * 2. Photo validation passed (MATCH or explicit UNVERIFIED fallback).
   * 3. Validated photo sha256 matches current photo and issue type.
   * 4. Location is strictly within Kharghar Sector 4 pilot boundary.
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

    // 1. Photo evidence presence check
    if (!draft.photoStoragePath || !draft.photoSha256) {
      await this.bot.sendMessage(chatId, "⚠️ Photographic evidence is required before submission.");
      return;
    }

    // 2. Photo validation status check (must be MATCH or UNVERIFIED fallback)
    if (
      draft.photoValidationStatus !== "MATCH" &&
      draft.photoValidationStatus !== "UNVERIFIED"
    ) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ Cannot submit report: photographic evidence validation has not passed."
      );
      return;
    }

    // 3. Stale validation check (revalidation required if photo or issue changed)
    if (
      draft.validatedPhotoSha256 !== draft.photoSha256 ||
      draft.validatedIssueTypeId !== draft.issueTypeId
    ) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ Issue type or photograph changed since validation. Revalidation required."
      );
      return;
    }

    // 4. Strict Pilot Geofence Check (<= 500m)
    const lat = draft.latitude ?? PILOT_CONFIG.centreLatitude;
    const lon = draft.longitude ?? PILOT_CONFIG.centreLongitude;
    const dist = calculateHaversineDistanceMetres(
      lat,
      lon,
      PILOT_CONFIG.centreLatitude,
      PILOT_CONFIG.centreLongitude
    );

    if (dist > PILOT_CONFIG.radiusMetres) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ Cannot submit report: location is outside Kharghar Sector 4 pilot boundary."
      );
      return;
    }

    void this.bot.sendChatAction(chatId, "typing");
    const loaderMsg = await this.bot.sendMessage(
      chatId,
      renderTelegramSkeletonLoader(
        "Registering Civic Report",
        "Submitting evidence & generating unique ticket reference...",
        4
      )
    );

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
        p_latitude: lat,
        p_longitude: lon,
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
      const jur = resolveJurisdiction(lat, lon, draft.description || "");

      let wardPoliceDetails = "";
      if (language === "hi") {
        wardPoliceDetails =
          `\n\n🏛️ <b>प्रशासनिक प्रभाग / Ward:</b> ${jur.wardName}` +
          `\n👮 <b>क्षेत्राधिकार पुलिस / Police:</b> ${jur.policeStation}` +
          `\n📞 <b>थाना हेल्पलाइन:</b> <code>${jur.policePhone}</code> | 🚨 <b>आपातकाल:</b> 112` +
          `\n🏢 <b>थाना पता:</b> ${jur.policeAddress}\n📍 <b>स्थानीय बीट:</b> ${jur.beatChowki}`;
      } else if (language === "mr") {
        wardPoliceDetails =
          `\n\n🏛️ <b>प्रशासकीय प्रभाग / Ward:</b> ${jur.wardName}` +
          `\n👮 <b>क्षेत्राधिकार पोलीस / Police:</b> ${jur.policeStationMr}` +
          `\n📞 <b>ठाणे संपर्क:</b> <code>${jur.policePhone}</code> | 🚨 <b>आणीबाणी:</b> 112` +
          `\n🏢 <b>पोलीस ठाणे पत्ता:</b> ${jur.policeAddress}\n📍 <b>स्थानिक बीट:</b> ${jur.beatChowki}`;
      } else {
        wardPoliceDetails =
          `\n\n🏛️ <b>Administrative Ward:</b> ${jur.wardName}` +
          `\n👮 <b>Jurisdictional Police:</b> ${jur.policeStation}` +
          `\n📞 <b>Station Desk:</b> <code>${jur.policePhone}</code> | 🚨 <b>Emergency:</b> 112` +
          `\n🏢 <b>Station Address:</b> ${jur.policeAddress}\n📍 <b>Local Beat:</b> ${jur.beatChowki}`;
      }

      const successMsg =
        MESSAGES[language].report_submitted.replace("{ticket_code}", ticketCode) +
        wardPoliceDetails;

      // Clear draft upon successful ticket creation
      await (supabase as any).rpc("clear_report_draft_by_hash", {
        p_telegram_user_hash: userHash,
      });

      const receiptKeyboard = {
        inline_keyboard: [
          [
            { text: "👮 Ward Police Info", callback_data: `police_${ticketCode}` },
            { text: "🎫 Track Ticket", callback_data: "action_track" },
          ],
          [
            { text: "📝 Report Another Issue", callback_data: "action_report" },
            { text: "🌐 Change Language", callback_data: "action_language" },
          ],
        ],
      };

      if (loaderMsg?.message_id) {
        const edited = await this.bot.editMessageText(chatId, loaderMsg.message_id, successMsg, receiptKeyboard);
        if (!edited) {
          await this.bot.sendMessage(chatId, successMsg, receiptKeyboard);
        }
      } else {
        await this.bot.sendMessage(chatId, successMsg, receiptKeyboard);
      }

      await this.persistState(
        userHash,
        encryptedChatId,
        "IDLE",
        { sessionUnlocked: true, language, languageChosenAt: draft.languageChosenAt },
        language
      );
    } catch (err) {
      console.error("Submission failed:", err);
      if (loaderMsg?.message_id) {
        await this.bot.deleteMessage(chatId, loaderMsg.message_id);
      }
      await this.bot.sendMessage(
        chatId,
        "⚠️ Failed to record submission in civic database. Tap below to try again:",
        {
          inline_keyboard: [
            [{ text: "📝 Report Civic Issue", callback_data: "action_report" }],
          ],
        }
      );
    }
  }

  // ==========================================================================
  // Helper UI methods
  // ==========================================================================

  /** Edit an existing bot message in place (faster, cleaner chat); fall back to sending a new one. */
  private async show(
    chatId: number,
    editMessageId: number | undefined,
    text: string,
    keyboard?: TelegramInlineKeyboardMarkup
  ): Promise<void> {
    if (editMessageId) {
      const edited = await this.bot.editMessageText(chatId, editMessageId, text, keyboard);
      if (edited) return;
    }
    await this.bot.sendMessage(chatId, text, keyboard);
  }

  private async sendLanguageSelection(chatId: number, forNewReport = false, greeting = ""): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: "🇬🇧 English", callback_data: "lang_en" }],
        [{ text: "🇮🇳 हिंदी (Hindi)", callback_data: "lang_hi" }],
        [{ text: "🇮🇳 मराठी (Marathi)", callback_data: "lang_mr" }],
        ...(forNewReport ? [[{ text: "❌ Cancel", callback_data: "action_cancel" }]] : []),
      ],
    };
    const prompt = forNewReport
      ? "📝 <b>New report</b>\n\nWhich language do you want to use for this report?\nइस शिकायत के लिए भाषा चुनें:\nया तक्रारीसाठी भाषा निवडा:"
      : "🌐 <b>Choose your language</b>\nअपनी भाषा चुनें / आपली भाषा निवडा:";
    await this.bot.sendMessage(chatId, greeting + prompt, keyboard);
  }

  private async sendQuickProblemMenu(
    chatId: number,
    lang: SupportedLanguage,
    editMessageId?: number,
    header = ""
  ): Promise<void> {
    const rows = QUICK_PROBLEMS.map((p, i) => {
      const option = getTaxonomyIssueOption(p.groupId, p.categoryId, p.issueTypeId);
      const label = option ? getResolvedLabel(option.label, lang) : p.issueTypeId;
      return [{ text: `${p.emoji} ${label}`, callback_data: `qp_${i}` }];
    });
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        ...rows,
        [{ text: `➕ ${MESSAGES[lang].other_problem}`, callback_data: "qp_other" }],
        [{ text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" }],
      ],
    };
    await this.show(chatId, editMessageId, header + MESSAGES[lang].choose_problem, keyboard);
  }

  private async sendGroupSelection(chatId: number, lang: SupportedLanguage): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        ...NAGRIK_TAXONOMY_V1.map((g) => [
          {
            text: getResolvedLabel(g.label, lang),
            callback_data: `group_${g.groupId}`,
          },
        ]),
        [{ text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" }],
      ],
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_group, keyboard);
  }

  private async sendCategorySelection(
    chatId: number,
    group: any,
    lang: SupportedLanguage
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        ...group.categories.map((c: any) => [
          {
            text: getResolvedLabel(c.label, lang),
            callback_data: `cat_${c.categoryId}`,
          },
        ]),
        [
          { text: "⬅️ Back", callback_data: "action_back_group" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_category, keyboard);
  }

  private async sendIssueSelection(
    chatId: number,
    category: any,
    lang: SupportedLanguage
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        ...category.options.map((o: any) => [
          {
            text: getResolvedLabel(o.label, lang),
            callback_data: `issue_${o.issueTypeId}`,
          },
        ]),
        [
          { text: "⬅️ Back", callback_data: "action_back_cat" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].choose_issue, keyboard);
  }

  private async sendVoiceDescriptionPrompt(
    chatId: number,
    lang: SupportedLanguage,
    editMessageId?: number,
    header = ""
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: MESSAGES[lang].btn_type_instead, callback_data: "action_type_desc" }],
        [
          { text: "⬅️ Back", callback_data: "action_back_quick" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };
    await this.show(chatId, editMessageId, header + MESSAGES[lang].send_voice_desc, keyboard);
  }

  private async sendPhotoPrompt(chatId: number, lang: SupportedLanguage): Promise<void> {
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: `🏷️ ${MESSAGES[lang].btn_change_issue}`, callback_data: "action_change_issue" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].send_photo, keyboard);
  }

  private async sendTranscriptReview(
    chatId: number,
    transcript: string,
    lang: SupportedLanguage,
    editMessageId?: number
  ): Promise<void> {
    const text = MESSAGES[lang].transcript_review.replace("{transcript}", transcript);
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: MESSAGES[lang].btn_use_transcript, callback_data: "action_use_transcript" }],
        [
          { text: MESSAGES[lang].btn_record_again, callback_data: "action_record_again" },
          { text: MESSAGES[lang].btn_edit_transcript, callback_data: "action_edit_transcript" },
        ],
        [{ text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" }],
      ],
    };
    if (editMessageId) {
      const edited = await this.bot.editMessageText(chatId, editMessageId, text, keyboard);
      if (edited) return;
    }
    await this.bot.sendMessage(chatId, text, keyboard);
  }

  private async sendLocationPrompt(chatId: number, lang: SupportedLanguage): Promise<void> {
    const cityBtn =
      lang === "hi"
        ? "📍 खारघर शहर (डिफ़ॉल्ट)"
        : lang === "mr"
          ? "📍 खारघर शहर (डीफॉल्ट)"
          : "📍 Kharghar City (Default)";

    const campusBtn =
      lang === "hi"
        ? "📍 ITM कैंपस (सेक्टर 4)"
        : lang === "mr"
          ? "📍 ITM कॅम्पस (सेक्टर 4)"
          : "📍 ITM Campus (Sector 4)";

    const keyboard: TelegramReplyKeyboardMarkup = {
      keyboard: [
        [{ text: MESSAGES[lang].btn_share_location, request_location: true }],
        [{ text: cityBtn }, { text: campusBtn }],
        [{ text: MESSAGES[lang].btn_cancel_report }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
    await this.bot.sendMessage(chatId, MESSAGES[lang].send_location, keyboard);
  }

  private async sendReviewSummary(
    chatId: number,
    draft: DraftPayload,
    lang: SupportedLanguage,
    editMessageId?: number
  ): Promise<void> {
    const category = getTaxonomyCategory(draft.groupId || "", draft.categoryId || "");
    const option = getTaxonomyIssueOption(
      draft.groupId || "",
      draft.categoryId || "",
      draft.issueTypeId || ""
    );

    const categoryName = category ? getResolvedLabel(category.label, lang) : draft.categoryId;
    const issueName = option ? getResolvedLabel(option.label, lang) : draft.issueTypeId;
    const photoStatusLabel =
      draft.photoValidationStatus === "MATCH"
        ? "Verified Match ✅"
        : draft.photoValidationStatus === "UNVERIFIED"
          ? "Attached (Unverified Manual Review)"
          : "Attached ✅";

    const jur = resolveJurisdiction(
      draft.latitude ?? PILOT_CONFIG.centreLatitude,
      draft.longitude ?? PILOT_CONFIG.centreLongitude,
      draft.description || ""
    );

    const summaryText =
      `${MESSAGES[lang].review_title}\n\n` +
      `<b>Domain:</b> ${draft.groupId}\n` +
      `<b>Category:</b> ${categoryName}\n` +
      `<b>Issue:</b> ${issueName}\n` +
      `<b>Description:</b> ${draft.description || "N/A"}\n` +
      `<b>Location:</b> ${draft.latitude?.toFixed(4)}, ${draft.longitude?.toFixed(4)}\n` +
      `<b>Ward:</b> ${jur.wardName}\n` +
      `<b>Police Authority:</b> ${jur.policeStation} (📞 ${jur.policePhone})\n` +
      `<b>Photo Evidence:</b> ${photoStatusLabel}\n` +
      `<b>Voice Note:</b> ${draft.voiceStoragePath ? "Attached ✅" : "None"}\n`;

    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: `✅ ${MESSAGES[lang].confirm_btn}`, callback_data: "action_confirm_submit" },
          { text: `❌ ${MESSAGES[lang].cancel_btn}`, callback_data: "action_cancel" },
        ],
      ],
    };

    if (editMessageId) {
      const edited = await this.bot.editMessageText(chatId, editMessageId, summaryText, keyboard);
      if (edited) return;
    }

    await this.bot.sendMessage(chatId, summaryText, keyboard);
  }

  private async sendWardPoliceDirectory(
    chatId: number,
    lang: SupportedLanguage = "en",
    editMessageId?: number
  ): Promise<void> {
    const isHi = lang === "hi";
    const isMr = lang === "mr";

    const title = isHi
      ? "👮 <b>खारघर नगर प्रशासनिक प्रभाग एवं पुलिस क्षेत्राधिकार</b>"
      : isMr
      ? "👮 <b>खारघर शहर प्रशासकीय प्रभाग आणि पोलीस अधिकारक्षेत्र</b>"
      : "👮 <b>Kharghar Municipal Ward & Police Jurisdiction</b>";

    const content =
      `${title}\n\n` +
      `<b>🏛️ नगरपालिका प्रभाग / Municipal Authority:</b>\n` +
      `पनवेल महानगरपालिका (PMC) प्रभाग समिती 'अ' (Kharghar Ward Committee 'A')\n` +
      `📍 कार्यालय: सेक्टर 12, खारघर | 📞 हेल्पलाईन: <code>022-27740123</code>\n\n` +
      `<b>👮 क्षेत्राधिकार पुलिस स्टेशन / Police Station:</b>\n` +
      `खारघर पोलीस ठाणे (Kharghar Police Station)\n` +
      `नवी मुंबई पोलीस आयुक्तालय (Zone II)\n` +
      `📍 पत्ता: प्लॉट 1, सेक्टर 7, उत्सव चौक जवळ, खारघर - 410210\n` +
      `📞 ठाणे डायरी / लँडलाईन: <code>022-27740100</code> / <code>022-27742100</code>\n` +
      `🚨 आपातकाल / Emergency SOS: <b>डायल 112</b>\n\n` +
      `<b>📍 स्थानिक प्रभाग एवं बीट चौकियां / Ward Beat Chowkis:</b>\n` +
      `• <b>बीट 1 (स्टेशन, सेक्टर 1-7, ITM):</b> <code>022-27740100</code>\n` +
      `• <b>बीट 2 (शिल्प चौक, सेक्टर 8-20):</b> <code>022-27740100</code>\n` +
      `• <b>बीट 3 (सेंट्रल पार्क, सेक्टर 21-25):</b> <code>022-27740100</code>\n` +
      `• <b>बीट 4 (व्हॅली शिल्प, सेक्टर 30-36):</b> <code>022-27740100</code>\n\n` +
      `<i>💡 नागरिक ॲपवर नोंदवलेली कोणतीही समस्या संबंधित प्रभाग आणि स्थानिक पोलिसांना दृश्यमान असते.</i>`;

    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "📝 Report Civic Issue", callback_data: "action_report" },
          { text: "🎫 Track Tickets", callback_data: "action_track" },
        ],
        [
          { text: "⬅️ Main Menu", callback_data: "action_menu" },
        ],
      ],
    };

    if (editMessageId) {
      const edited = await this.bot.editMessageText(chatId, editMessageId, content, keyboard);
      if (edited) return;
    }
    await this.bot.sendMessage(chatId, content, keyboard);
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
