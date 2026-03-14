import type { Evidence, NPCSentiment, NPCSchedule } from "../gameState.js";

export const CRUISE_CONFIG = {
  id: "cruise",
  name: "Death on the Meridian",

  evidence: [
    {
      id: "insulin_pen",
      name: "Tampered Insulin Pen",
      description: "Marcus's insulin pen found in the penthouse",
      location: "penthouse",
      detail: "Marcus's insulin pen. The cartridge label says insulin, but the liquid inside has a slightly different viscosity. A medical professional would know the difference.",
    },
    {
      id: "potassium_vial",
      name: "Empty Potassium Chloride Vial",
      description: "An empty vial hidden in the medical bay",
      location: "medical_bay",
      detail: "An empty vial of potassium chloride hidden behind medication boxes in the medical bay. The dispensing log shows no authorized use.",
    },
    {
      id: "fake_credentials",
      name: "Credential Discrepancies",
      description: "A background check printout for Dr. Vasquez",
      location: "security_office",
      detail: "A background check printout for Dr. Vasquez. The medical school listed doesn't have her in their graduation records. Someone circled this in red pen.",
    },
    {
      id: "deck7_footage",
      name: "Deck 7 Camera Footage",
      description: "Backup camera footage from Deck 7",
      location: "security_office",
      detail: "A USB drive labeled 'Deck 7 backup.' The main camera was 'malfunctioning,' but this backup shows a figure in a white medical coat walking toward the penthouse suite at 11:28 PM.",
    },
    {
      id: "medical_bag",
      name: "Vasquez's Medical Bag",
      description: "Dr. Vasquez's medical bag found in the medical bay",
      location: "medical_bay",
      detail: "Dr. Vasquez's medical bag. Inside: syringes, vials, and a pair of latex gloves with a tiny smear of what looks like dried blood. Also contains herbs that aren't standard medical supplies.",
    },
    {
      id: "prenup_document",
      name: "Thorne Prenuptial Agreement",
      description: "A prenuptial agreement found in the penthouse",
      location: "penthouse",
      detail: "A prenuptial agreement between Marcus and Isabelle Thorne. In the event of divorce, Isabelle receives only $500,000. In the event of death, the prenup is void and she inherits everything.",
    },
    {
      id: "love_notes",
      name: "Hidden Love Notes",
      description: "Handwritten notes found in a casino lockbox",
      location: "casino",
      detail: "A bundle of handwritten notes tucked in a casino lockbox. Intimate letters between 'I' and 'L' — clearly Isabelle and Lydia. They reference plans to 'start fresh in New York.'",
    },
    {
      id: "volkov_ledger",
      name: "Volkov's Financial Ledger",
      description: "A leather notebook with financial records",
      location: "restaurant",
      detail: "A leather notebook with columns of figures. Cross-references casino chips purchased with wire transfers from offshore accounts. Classic money laundering records.",
    },
    {
      id: "wells_meeting_note",
      name: "Handwritten Meeting Note",
      description: "A torn note in Congressman Wells's handwriting",
      location: "library",
      detail: "A torn note in Congressman Wells's handwriting: 'Meet H. at observation deck, 1 AM. Must discuss M.T. situation. Cannot let this reach the press.'",
    },
    {
      id: "master_keycard_log",
      name: "Keycard Access Log",
      description: "A printout of master keycard usage",
      location: "staff_quarters",
      detail: "A printout of master keycard usage. Sofia's card accessed the penthouse at 5:30 AM. Another entry shows a medical staff card accessing it at 11:31 PM.",
    },
    {
      id: "harassment_complaint",
      name: "Filed Harassment Complaint",
      description: "A formal complaint filed by Sofia Andersson",
      location: "staff_quarters",
      detail: "A formal complaint filed by Sofia Andersson against Marcus Thorne for sexual harassment. Stamped 'REVIEWED — NO ACTION' by the cruise line.",
    },
    {
      id: "yukis_photos",
      name: "Journalist's Photographs",
      description: "A camera memory card with timestamped photos",
      location: "observation_deck",
      detail: "A camera's memory card with timestamped photos. Taken at 10:05 PM inside what appears to be Marcus's suite. Documents on the desk show dealings with Volkov and defense contracts.",
    },
    {
      id: "broken_camera_report",
      name: "Camera Malfunction Report",
      description: "A maintenance report for the Deck 7 corridor camera",
      location: "security_office",
      detail: "A maintenance report for the Deck 7 corridor camera. Filed at 11:15 PM — 13 minutes before Vasquez was seen on the backup footage. The 'malfunction' was a manually disconnected cable.",
    },
    {
      id: "romano_herb_list",
      name: "Kitchen Supply Requisition",
      description: "Chef Romano's special supply orders",
      location: "kitchen",
      detail: "Chef Romano's special supply orders. Includes ephedra, foxglove extract, and other compounds marked 'For Dr. V — medicinal use.' One entry is for potassium chloride — 'for preserving specialty meats.'",
    },
  ] as Evidence[],

  evidencePositions: {
    // penthouse (x:27-32, y:3-8)
    insulin_pen:          { x: 29, y: 5 },
    prenup_document:      { x: 31, y: 7 },
    // medical_bay (x:14-21, y:33-38)
    potassium_vial:       { x: 16, y: 35 },
    medical_bag:          { x: 20, y: 37 },
    // security_office (x:27-32, y:33-38)
    fake_credentials:     { x: 28, y: 34 },
    deck7_footage:        { x: 31, y: 36 },
    broken_camera_report: { x: 29, y: 38 },
    // casino (x:27-32, y:14-17)
    love_notes:           { x: 30, y: 15 },
    // restaurant (x:14-21, y:23-28)
    volkov_ledger:        { x: 17, y: 25 },
    // library (x:3-8, y:14-17)
    wells_meeting_note:   { x: 5, y: 16 },
    // staff_quarters (x:3-8, y:33-38)
    master_keycard_log:   { x: 4, y: 35 },
    harassment_complaint: { x: 7, y: 37 },
    // observation_deck (x:14-21, y:3-8)
    yukis_photos:         { x: 18, y: 6 },
    // kitchen (x:3-8, y:23-28)
    romano_herb_list:     { x: 6, y: 26 },
  } as Record<string, { x: number; y: number }>,

  correctSuspect: "vasquez",

  keyEvidence: [
    "insulin_pen",
    "potassium_vial",
    "fake_credentials",
    "deck7_footage",
    "medical_bag",
    "broken_camera_report",
  ],

  motiveKeywords: [
    "credentials",
    "forged",
    "fake doctor",
    "illegal",
    "license",
    "practicing",
    "malpractice",
    "exposure",
  ],

  initialSentiments: {
    vasquez: {
      towardDetective: 4,
      towardOthers: {
        harrington: 1, isabelle: 2, volkov: -1, diego: -3,
        lydia: 0, wells: 0, sofia: -1, romano: 5, okafor: -4, yuki: -3,
      },
      emotionalState: "nervous",
      recentEmotions: [],
    },
    harrington: {
      towardDetective: 1,
      towardOthers: {
        vasquez: 0, isabelle: -2, volkov: -1, diego: 1,
        lydia: 0, wells: -3, sofia: 2, romano: 1, okafor: 4, yuki: -1,
      },
      emotionalState: "defensive",
      recentEmotions: [],
    },
    isabelle: {
      towardDetective: 2,
      towardOthers: {
        vasquez: 1, harrington: 0, volkov: -3, diego: -2,
        lydia: 9, wells: -1, sofia: 3, romano: 2, okafor: 0, yuki: -1,
      },
      emotionalState: "scared",
      recentEmotions: [],
    },
    volkov: {
      towardDetective: -1,
      towardOthers: {
        vasquez: 0, harrington: -2, isabelle: 1, diego: 3,
        lydia: -4, wells: 2, sofia: 0, romano: 1, okafor: -3, yuki: -2,
      },
      emotionalState: "calm",
      recentEmotions: [],
    },
    diego: {
      towardDetective: 3,
      towardOthers: {
        vasquez: -2, harrington: 1, isabelle: 0, volkov: 2,
        lydia: 0, wells: -1, sofia: 1, romano: 0, okafor: 4, yuki: 1,
      },
      emotionalState: "calm",
      recentEmotions: [],
    },
    lydia: {
      towardDetective: 1,
      towardOthers: {
        vasquez: 0, harrington: 0, isabelle: 9, volkov: -6,
        diego: 0, wells: -1, sofia: 3, romano: 1, okafor: 0, yuki: -1,
      },
      emotionalState: "nervous",
      recentEmotions: [],
    },
    wells: {
      towardDetective: 0,
      towardOthers: {
        vasquez: 0, harrington: 2, isabelle: -1, volkov: 3,
        diego: 0, lydia: 0, sofia: -2, romano: 0, okafor: -3, yuki: -5,
      },
      emotionalState: "calm",
      recentEmotions: [],
    },
    sofia: {
      towardDetective: 5,
      towardOthers: {
        vasquez: -2, harrington: 1, isabelle: 3, volkov: -1,
        diego: 0, lydia: 2, wells: -3, romano: 3, okafor: 4, yuki: 1,
      },
      emotionalState: "angry",
      recentEmotions: [],
    },
    romano: {
      towardDetective: 3,
      towardOthers: {
        vasquez: 5, harrington: 1, isabelle: 3, volkov: 0,
        diego: 0, lydia: 1, wells: -1, sofia: 2, okafor: 0, yuki: 1,
      },
      emotionalState: "angry",
      recentEmotions: [],
    },
    okafor: {
      towardDetective: 6,
      towardOthers: {
        vasquez: -2, harrington: -1, isabelle: 0, volkov: -3,
        diego: 3, lydia: 0, wells: -4, sofia: 3, romano: 0, yuki: 2,
      },
      emotionalState: "calm",
      recentEmotions: [],
    },
    yuki: {
      towardDetective: 4,
      towardOthers: {
        vasquez: -1, harrington: 0, isabelle: 1, volkov: 2,
        diego: 3, lydia: 0, wells: -3, sofia: 1, romano: 1, okafor: 3,
      },
      emotionalState: "cooperative",
      recentEmotions: [],
    },
  } as Record<string, NPCSentiment>,

  initialNPCPositions: [
    { id: "vasquez",    name: "Dr. Vasquez",      location: "medical_bay",      x: 18, y: 36 },
    { id: "harrington", name: "Capt. Harrington", location: "bridge",           x: 5,  y: 5  },
    { id: "isabelle",   name: "Isabelle Thorne",  location: "lounge",           x: 17, y: 15 },
    { id: "volkov",     name: "Nikolai Volkov",   location: "restaurant",       x: 19, y: 26 },
    { id: "diego",      name: "Diego Reyes",      location: "pool_deck",        x: 30, y: 25 },
    { id: "lydia",      name: "Lydia Chen",       location: "casino",           x: 29, y: 16 },
    { id: "wells",      name: "Congressman Wells", location: "library",         x: 6,  y: 15 },
    { id: "sofia",      name: "Sofia Andersson",  location: "staff_quarters",   x: 5,  y: 36 },
    { id: "romano",     name: "Chef Romano",      location: "kitchen",          x: 5,  y: 25 },
    { id: "okafor",     name: "Chief Okafor",     location: "security_office",  x: 30, y: 35 },
    { id: "yuki",       name: "Yuki Tanaka",      location: "observation_deck", x: 16, y: 5  },
  ] as NPCSchedule[],

  winMessage:
    "Brilliant deduction, Detective! Dr. Elena Vasquez, practicing medicine with forged credentials, murdered Marcus Thorne by replacing his insulin with a lethal dose of potassium chloride. She couldn't let him expose her — it would mean prison and the unraveling of eight years of deception. Case closed!",
};
