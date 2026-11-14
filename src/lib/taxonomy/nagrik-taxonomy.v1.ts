/**
 * NAGRIK TAXONOMY v1.0
 * Authority: PRD Section 5 & TRD Section 7
 * Exactly 3 Groups x 4 Categories x (4 Issue Options + 1 Other) = 60 Leaves.
 * All leaf nodes support English (en), Hindi (hi), and Marathi (mr) labels.
 */

export type SupportedLanguage = "en" | "hi" | "mr";

export interface LocalizedLabel {
  en: string;
  hi: string;
  mr: string;
}

export interface TaxonomyIssueOption {
  issueTypeId: string;
  label: LocalizedLabel;
}

export interface TaxonomyCategory {
  categoryId: string;
  label: LocalizedLabel;
  options: TaxonomyIssueOption[];
}

export interface TaxonomyGroup {
  groupId: string;
  label: LocalizedLabel;
  categories: TaxonomyCategory[];
}

export const NAGRIK_TAXONOMY_V1: readonly TaxonomyGroup[] = [
  // ==========================================================================
  // GROUP 1: Roads, Footpaths & Mobility
  // ==========================================================================
  {
    groupId: "roads_mobility",
    label: {
      en: "Roads, Footpaths & Mobility",
      hi: "सड़कें, फुटपाथ और आवागमन",
      mr: "रस्ते, पदपथ आणि वाहतूक",
    },
    categories: [
      {
        categoryId: "road_surface",
        label: {
          en: "Road Surface",
          hi: "सड़क की सतह",
          mr: "रस्त्याचा पृष्ठभाग",
        },
        options: [
          {
            issueTypeId: "pothole",
            label: {
              en: "Pothole",
              hi: "सड़क पर गड्ढा",
              mr: "रस्त्यावरील खड्डा",
            },
          },
          {
            issueTypeId: "cracked_broken_road",
            label: {
              en: "Cracked or broken road",
              hi: "टूटी या दरार वाली सड़क",
              mr: "तडे गेलेला किंवा तुटलेला रस्ता",
            },
          },
          {
            issueTypeId: "uneven_sunken_road",
            label: {
              en: "Uneven or sunken road",
              hi: "ऊबड़-खाबड़ या धंसी हुई सड़क",
              mr: "असमान किंवा खचलेला रस्ता",
            },
          },
          {
            issueTypeId: "waterlogged_road",
            label: {
              en: "Waterlogged road surface",
              hi: "सड़क पर जलभराव",
              mr: "रस्त्यावर साचलेले पाणी",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other road surface issue",
              hi: "सड़क संबंधी अन्य समस्या",
              mr: "रस्त्यासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "footpaths_pedestrian",
        label: {
          en: "Footpaths & Pedestrian Access",
          hi: "फुटपाथ और पैदल आवागमन",
          mr: "पदपथ आणि पादचारी मार्ग",
        },
        options: [
          {
            issueTypeId: "broken_missing_paving",
            label: {
              en: "Broken or missing paving",
              hi: "टूटी या गायब फुटपाथ टाइल",
              mr: "तुटलेली किंवा गायब पदपथ फरशी",
            },
          },
          {
            issueTypeId: "obstructed_footpath",
            label: {
              en: "Obstructed footpath",
              hi: "फुटपाथ पर अतिक्रमण या बाधा",
              mr: "पदपथावरील अडथळा",
            },
          },
          {
            issueTypeId: "damaged_kerb_ramp",
            label: {
              en: "Damaged kerb or access ramp",
              hi: "क्षतिग्रस्त कर्ब या रैंप",
              mr: "खराब झालेला कर्ब किंवा रॅम्प",
            },
          },
          {
            issueTypeId: "damaged_pedestrian_railing",
            label: {
              en: "Damaged pedestrian railing",
              hi: "क्षतिग्रस्त पैदल रेलिंग",
              mr: "पादचारी रेलिंगचे नुकसान",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other footpath issue",
              hi: "फुटपाथ संबंधी अन्य समस्या",
              mr: "पदपथासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "road_safety_assets",
        label: {
          en: "Road Safety Assets",
          hi: "सड़क सुरक्षा उपकरण",
          mr: "रस्ता सुरक्षा साधने",
        },
        options: [
          {
            issueTypeId: "damaged_speed_breaker",
            label: {
              en: "Damaged speed breaker",
              hi: "क्षतिग्रस्त स्पीड ब्रेकर",
              mr: "खराब झालेला गतिरोधक",
            },
          },
          {
            issueTypeId: "missing_damaged_sign",
            label: {
              en: "Missing or damaged road sign",
              hi: "गायब या टूटा सड़क संकेत",
              mr: "गायब किंवा खराब झालेला रस्ता फलक",
            },
          },
          {
            issueTypeId: "faded_missing_markings",
            label: {
              en: "Faded or missing road markings",
              hi: "मिटी या गायब सड़क मार्किंग",
              mr: "अस्पष्ट किंवा गायब रस्ता खुणा",
            },
          },
          {
            issueTypeId: "damaged_safety_barrier",
            label: {
              en: "Damaged safety barrier or guardrail",
              hi: "क्षतिग्रस्त सुरक्षा बैरियर",
              mr: "खराब झालेला सुरक्षा अडथळा",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other road safety issue",
              hi: "सड़क सुरक्षा संबंधी अन्य समस्या",
              mr: "रस्ता सुरक्षेशी संबंधित इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "road_obstructions_open_works",
        label: {
          en: "Road Obstructions & Open Works",
          hi: "सड़क पर बाधाएं और खुले निर्माण कार्य",
          mr: "रस्त्यावरील अडथळे आणि उघडी कामे",
        },
        options: [
          {
            issueTypeId: "open_excavation_trench",
            label: {
              en: "Open excavation or uncovered trench",
              hi: "खुला गड्ढा या खुला ट्रेंच",
              mr: "उघडे उत्खनन किंवा खंदक",
            },
          },
          {
            issueTypeId: "debris_blocking_road",
            label: {
              en: "Debris or material blocking the road",
              hi: "सड़क पर मलबा या निर्माण सामग्री",
              mr: "रस्त्यावर अडथळा आणणारा कचरा किंवा साहित्य",
            },
          },
          {
            issueTypeId: "damaged_missing_manhole",
            label: {
              en: "Damaged or missing manhole cover",
              hi: "क्षतिग्रस्त या खुला मैनहोल ढक्कन",
              mr: "खराब झालेले किंवा गायब मॅनहोल झाकण",
            },
          },
          {
            issueTypeId: "fallen_tree_object",
            label: {
              en: "Fallen tree or object blocking access",
              hi: "गिरा हुआ पेड़ या भारी रुकावट",
              mr: "पडलेले झाड किंवा वाहतुकीस अडथळा",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other road obstruction",
              hi: "सड़क रुकावट संबंधी अन्य समस्या",
              mr: "रस्त्यावरील इतर अडथळे",
            },
          },
        ],
      },
    ],
  },

  // ==========================================================================
  // GROUP 2: Waste, Cleanliness & Drainage
  // ==========================================================================
  {
    groupId: "waste_cleanliness_drainage",
    label: {
      en: "Waste, Cleanliness & Drainage",
      hi: "कचरा, स्वच्छता और जल निकासी",
      mr: "कचरा, स्वच्छता आणि सांडपाणी निचरा",
    },
    categories: [
      {
        categoryId: "garbage_waste_collection",
        label: {
          en: "Garbage & Waste Collection",
          hi: "कचरा और अपशिष्ट संग्रहण",
          mr: "कचरा आणि कचरा संकलन",
        },
        options: [
          {
            issueTypeId: "garbage_accumulation",
            label: {
              en: "Garbage accumulation",
              hi: "कचरा जमा होना",
              mr: "कचरा साचणे",
            },
          },
          {
            issueTypeId: "overflowing_public_bin",
            label: {
              en: "Overflowing public bin",
              hi: "भरा हुआ सार्वजनिक डस्टबिन",
              mr: "ओसंडून वाहणारी सार्वजनिक कचराकुंडी",
            },
          },
          {
            issueTypeId: "missed_waste_collection",
            label: {
              en: "Missed waste collection",
              hi: "कचरा न उठना",
              mr: "कचरा संकलन न होणे",
            },
          },
          {
            issueTypeId: "open_illegal_dumping",
            label: {
              en: "Open or illegal dumping",
              hi: "खुले में अवैध कचरा फेंकना",
              mr: "उघड्यावर कचरा टाकणे",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other garbage issue",
              hi: "कचरा संबंधी अन्य समस्या",
              mr: "कचऱ्यासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "drains_stormwater",
        label: {
          en: "Drains & Stormwater",
          hi: "नालियां और बरसाती पानी",
          mr: "गटारे आणि पावसाचे पाणी",
        },
        options: [
          {
            issueTypeId: "blocked_drain",
            label: {
              en: "Blocked drain",
              hi: "बंद या जाम नाली",
              mr: "तुंबलेली गटार",
            },
          },
          {
            issueTypeId: "overflowing_drain",
            label: {
              en: "Overflowing drain",
              hi: "उफनती नाली",
              mr: "ओसंडून वाहणारी गटार",
            },
          },
          {
            issueTypeId: "broken_missing_drain_cover",
            label: {
              en: "Broken or missing drain cover",
              hi: "नाली का टूटा या गायब ढक्कन",
              mr: "तुटलेले किंवा गायब गटार झाकण",
            },
          },
          {
            issueTypeId: "stagnant_water",
            label: {
              en: "Stagnant water or waterlogging",
              hi: "रुका हुआ गंदा पानी या जलभराव",
              mr: "साचलेले पाणी",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other drain issue",
              hi: "नाली संबंधी अन्य समस्या",
              mr: "गटारासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "public_sanitation",
        label: {
          en: "Public Sanitation",
          hi: "सार्वजनिक स्वच्छता",
          mr: "सार्वजनिक स्वच्छता",
        },
        options: [
          {
            issueTypeId: "dirty_public_toilet",
            label: {
              en: "Dirty public toilet",
              hi: "गंदा सार्वजनिक शौचालय",
              mr: "अस्वच्छ सार्वजनिक शौचालय",
            },
          },
          {
            issueTypeId: "damaged_unusable_toilet",
            label: {
              en: "Damaged or unusable public toilet",
              hi: "क्षतिग्रस्त या बंद शौचालय",
              mr: "नादुरुस्त सार्वजनिक शौचालय",
            },
          },
          {
            issueTypeId: "sanitation_overflow",
            label: {
              en: "Sanitation overflow",
              hi: "सीवेज या शौचालय का ओवरफ्लो",
              mr: "सांडपाणी ओसंडणे",
            },
          },
          {
            issueTypeId: "persistent_foul_odour",
            label: {
              en: "Persistent foul odour",
              hi: "लगातार तेज दुर्गंध",
              mr: "तीव्र दुर्गंधी",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other public sanitation issue",
              hi: "सार्वजनिक स्वच्छता संबंधी अन्य समस्या",
              mr: "सार्वजनिक स्वच्छतेसंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "litter_construction_waste",
        label: {
          en: "Litter & Construction Waste",
          hi: "फैला कचरा और निर्माण मलबा",
          mr: "पसरलेला कचरा आणि बांधकाम राडारोडा",
        },
        options: [
          {
            issueTypeId: "litter_accumulation",
            label: {
              en: "Litter accumulation in a public area",
              hi: "सार्वजनिक स्थान पर बिखरा कचरा",
              mr: "सार्वजनिक जागेत साचलेला कचरा",
            },
          },
          {
            issueTypeId: "construction_demolition_debris",
            label: {
              en: "Construction or demolition debris",
              hi: "निर्माण या तोड़फोड़ का मलबा",
              mr: "बांधकाम किंवा पाडकामाचा राडारोडा",
            },
          },
          {
            issueTypeId: "waste_scattered_collection_point",
            label: {
              en: "Waste scattered around a collection point",
              hi: "कचरा केंद्र के आसपास फैला कचरा",
              mr: "कचरा संकलन केंद्राभोवती पसरलेला कचरा",
            },
          },
          {
            issueTypeId: "silt_mud_accumulation",
            label: {
              en: "Silt or mud accumulation on a public path",
              hi: "रास्ते पर गाद या कीचड़ का जमाव",
              mr: "रस्त्यावर साचलेला गाळ किंवा चिखल",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other debris issue",
              hi: "मलबा संबंधी अन्य समस्या",
              mr: "राडारोड्यासंबंधी इतर समस्या",
            },
          },
        ],
      },
    ],
  },

  // ==========================================================================
  // GROUP 3: Public Utilities, Lighting & Green Spaces
  // ==========================================================================
  {
    groupId: "utilities_lighting_greenery",
    label: {
      en: "Public Utilities, Lighting & Green Spaces",
      hi: "सार्वजनिक सुविधाएं, प्रकाश और हरित क्षेत्र",
      mr: "सार्वजनिक सुविधा, पथदिवे आणि हरित क्षेत्रे",
    },
    categories: [
      {
        categoryId: "street_lighting_electrical",
        label: {
          en: "Street Lighting & Electrical Fixtures",
          hi: "स्ट्रीट लाइट और बिजली के उपकरण",
          mr: "पथदिवे आणि विद्युत उपकरणे",
        },
        options: [
          {
            issueTypeId: "streetlight_not_working",
            label: {
              en: "Streetlight not working",
              hi: "स्ट्रीट लाइट बंद होना",
              mr: "पथदिवा बंद असणे",
            },
          },
          {
            issueTypeId: "flickering_streetlight",
            label: {
              en: "Flickering streetlight",
              hi: "टिमटिमाती स्ट्रीट लाइट",
              mr: "लुकलुकणारा पथदिवा",
            },
          },
          {
            issueTypeId: "damaged_pole_fixture",
            label: {
              en: "Damaged pole or light fixture",
              hi: "क्षतिग्रस्त खंभा या लाइट फिटिंग",
              mr: "खराब झालेला खांब किंवा दिवा",
            },
          },
          {
            issueTypeId: "exposed_damaged_cable",
            label: {
              en: "Exposed or damaged electrical cable",
              hi: "खुला या क्षतिग्रस्त बिजली का तार",
              mr: "उघडी किंवा तुटलेली वीजतार",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other lighting issue",
              hi: "स्ट्रीट लाइट संबंधी अन्य समस्या",
              mr: "पथदिव्यासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "water_supply_public_taps",
        label: {
          en: "Water Supply & Public Taps",
          hi: "पानी की आपूर्ति और सार्वजनिक नल",
          mr: "पाणीपुरवठा आणि सार्वजनिक नळ",
        },
        options: [
          {
            issueTypeId: "water_pipeline_leakage",
            label: {
              en: "Water pipeline leakage",
              hi: "पानी की पाइपलाइन में लीकेज",
              mr: "पाण्याच्या पाईपलाईनची गळती",
            },
          },
          {
            issueTypeId: "broken_public_tap",
            label: {
              en: "Broken public tap",
              hi: "टूटा हुआ सार्वजनिक नल",
              mr: "तुटलेला सार्वजनिक नळ",
            },
          },
          {
            issueTypeId: "overflowing_water_line_tank",
            label: {
              en: "Overflowing water line or public tank",
              hi: "पानी की टंकी या लाइन का ओवरफ्लो",
              mr: "पाण्याची टाकी किंवा पाईप ओसंडणे",
            },
          },
          {
            issueTypeId: "water_supply_disruption",
            label: {
              en: "Water supply disruption at a public facility",
              hi: "सार्वजनिक सुविधा में पानी की आपूर्ति बंद",
              mr: "सार्वजनिक ठिकाणी पाणीपुरवठा खंडित",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other water supply issue",
              hi: "पानी आपूर्ति संबंधी अन्य समस्या",
              mr: "पाणीपुरवठ्यासंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "parks_public_amenities",
        label: {
          en: "Parks & Public Amenities",
          hi: "पार्क और सार्वजनिक सुविधाएं",
          mr: "उद्याने आणि सार्वजनिक सुविधा",
        },
        options: [
          {
            issueTypeId: "damaged_bench_seating",
            label: {
              en: "Damaged bench or seating",
              hi: "टूटी हुई बेंच या बैठने का स्थान",
              mr: "तुटलेले बाक किंवा बैठक व्यवस्था",
            },
          },
          {
            issueTypeId: "broken_play_equipment",
            label: {
              en: "Broken play equipment",
              hi: "बच्चों के खेल का टूटा उपकरण",
              mr: "तुटलेली खेळणी",
            },
          },
          {
            issueTypeId: "damaged_public_railing",
            label: {
              en: "Damaged public railing or fence",
              hi: "सार्वजनिक रेलिंग या बाड़ का टूटना",
              mr: "सार्वजनिक रेलिंग किंवा कुंपणाचे नुकसान",
            },
          },
          {
            issueTypeId: "damaged_public_sign_fixture",
            label: {
              en: "Damaged public sign or fixture",
              hi: "क्षतिग्रस्त साइन बोर्ड या उपकरण",
              mr: "खराब झालेला माहिती फलक",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other park or amenity issue",
              hi: "पार्क या सुविधा संबंधी अन्य समस्या",
              mr: "उद्यान किंवा सुविधेसंबंधी इतर समस्या",
            },
          },
        ],
      },
      {
        categoryId: "trees_green_spaces",
        label: {
          en: "Trees & Green Spaces",
          hi: "पेड़ और हरित क्षेत्र",
          mr: "झाडे आणि हरित क्षेत्रे",
        },
        options: [
          {
            issueTypeId: "fallen_branch_tree",
            label: {
              en: "Fallen branch or tree",
              hi: "गिरा हुआ पेड़ या भारी डाल",
              mr: "पडलेले झाड किंवा मोठी फांदी",
            },
          },
          {
            issueTypeId: "unsafe_leaning_tree",
            label: {
              en: "Unsafe leaning tree",
              hi: "खतरनाक रूप से झुका हुआ पेड़",
              mr: "धोकादायक झुकलेले झाड",
            },
          },
          {
            issueTypeId: "damaged_tree_guard",
            label: {
              en: "Damaged tree guard",
              hi: "क्षतिग्रस्त ट्री गार्ड",
              mr: "खराब झालेले ट्री गार्ड",
            },
          },
          {
            issueTypeId: "overgrown_vegetation",
            label: {
              en: "Overgrown vegetation blocking public access",
              hi: "बढ़ी हुई झाड़ियों से बाधित रास्ता",
              mr: "वाढलेल्या झाडीमुळे बंद झालेला मार्ग",
            },
          },
          {
            issueTypeId: "other",
            label: {
              en: "Other tree or green space issue",
              hi: "पेड़ या हरित क्षेत्र संबंधी अन्य समस्या",
              mr: "झाडे किंवा हरित क्षेत्रासंबंधी इतर समस्या",
            },
          },
        ],
      },
    ],
  },
] as const;

/**
 * Helpers to look up taxonomy nodes by stable identifiers
 */
export function getTaxonomyGroup(groupId: string): TaxonomyGroup | undefined {
  return NAGRIK_TAXONOMY_V1.find((g) => g.groupId === groupId);
}

export function getTaxonomyCategory(
  groupId: string,
  categoryId: string
): TaxonomyCategory | undefined {
  const group = getTaxonomyGroup(groupId);
  return group?.categories.find((c) => c.categoryId === categoryId);
}

export function getTaxonomyIssueOption(
  groupId: string,
  categoryId: string,
  issueTypeId: string
): TaxonomyIssueOption | undefined {
  const category = getTaxonomyCategory(groupId, categoryId);
  return category?.options.find((o) => o.issueTypeId === issueTypeId);
}

export function getResolvedLabel(
  label: LocalizedLabel,
  lang: SupportedLanguage = "en"
): string {
  return label[lang] || label.en;
}
