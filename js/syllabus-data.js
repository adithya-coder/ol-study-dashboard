/**
 * Static syllabus data definition for O/L 2026 Smart Study Dashboard.
 * Contains all 9 subjects with lesson definitions based on the
 * Sri Lankan G.C.E. Ordinary Level syllabus (Sinhala Medium).
 *
 * Each lesson has an examWeight indicating frequency in past papers:
 *   high   = appears every year
 *   medium = appears most years
 *   low    = appears occasionally
 */

export const SYLLABUS_DATA = [
  {
    id: 'mathematics',
    name: 'ගණිතය',
    lessons: [
      { id: 'math_number_systems', name: 'සංඛ්‍යා පද්ධති', order: 1, examWeight: 'high' },
      { id: 'math_indices', name: 'දර්ශක', order: 2, examWeight: 'high' },
      { id: 'math_algebra', name: 'වීජ ගණිතය', order: 3, examWeight: 'high' },
      { id: 'math_equations', name: 'සමීකරණ', order: 4, examWeight: 'high' },
      { id: 'math_inequalities', name: 'අසමානතා', order: 5, examWeight: 'medium' },
      { id: 'math_fractions', name: 'භාග', order: 6, examWeight: 'high' },
      { id: 'math_percentages', name: 'ප්‍රතිශත', order: 7, examWeight: 'high' },
      { id: 'math_geometry', name: 'ජ්‍යාමිතිය', order: 8, examWeight: 'high' },
      { id: 'math_triangles', name: 'ත්‍රිකෝණ', order: 9, examWeight: 'high' },
      { id: 'math_circles', name: 'වෘත්ත', order: 10, examWeight: 'high' },
      { id: 'math_trigonometry', name: 'ත්‍රිකෝණමිතිය', order: 11, examWeight: 'high' },
      { id: 'math_statistics', name: 'සංඛ්‍යානය', order: 12, examWeight: 'high' },
      { id: 'math_probability', name: 'සම්භාවිතාව', order: 13, examWeight: 'medium' },
      { id: 'math_sets', name: 'කුලක', order: 14, examWeight: 'medium' },
      { id: 'math_graphs', name: 'ප්‍රස්තාර', order: 15, examWeight: 'high' }
    ]
  },
  {
    id: 'science',
    name: 'විද්‍යාව',
    lessons: [
      { id: 'sci_measurement', name: 'මිනුම්', order: 1, examWeight: 'medium' },
      { id: 'sci_force_motion', name: 'බල හා චලිතය', order: 2, examWeight: 'high' },
      { id: 'sci_energy', name: 'ශක්තිය', order: 3, examWeight: 'high' },
      { id: 'sci_heat', name: 'තාපය', order: 4, examWeight: 'high' },
      { id: 'sci_light', name: 'ආලෝකය', order: 5, examWeight: 'high' },
      { id: 'sci_sound', name: 'ශබ්දය', order: 6, examWeight: 'medium' },
      { id: 'sci_electricity', name: 'විද්‍යුතය', order: 7, examWeight: 'high' },
      { id: 'sci_magnetism', name: 'චුම්බකත්වය', order: 8, examWeight: 'medium' },
      { id: 'sci_atoms', name: 'පරමාණු හා මූලද්‍රව්‍ය', order: 9, examWeight: 'high' },
      { id: 'sci_compounds', name: 'සංයෝග හා මිශ්‍රණ', order: 10, examWeight: 'high' },
      { id: 'sci_reactions', name: 'රසායනික ප්‍රතික්‍රියා', order: 11, examWeight: 'high' },
      { id: 'sci_carbon', name: 'කාබන් හා කාබන් සංයෝග', order: 12, examWeight: 'medium' },
      { id: 'sci_cells', name: 'සෛල ව්‍යුහය හා ක්‍රියාකාරිත්වය', order: 13, examWeight: 'high' },
      { id: 'sci_ecology', name: 'පරිසර විද්‍යාව', order: 14, examWeight: 'medium' },
      { id: 'sci_genetics', name: 'ප්‍රවේණිය', order: 15, examWeight: 'low' }
    ]
  },
  {
    id: 'sinhala',
    name: 'සිංහල',
    lessons: [
      { id: 'sin_grammar_nouns', name: 'නාම පද', order: 1, examWeight: 'high' },
      { id: 'sin_grammar_verbs', name: 'ක්‍රියා පද', order: 2, examWeight: 'high' },
      { id: 'sin_grammar_sentences', name: 'වාක්‍ය ව්‍යුහය', order: 3, examWeight: 'high' },
      { id: 'sin_essay_writing', name: 'රචනා ලිවීම', order: 4, examWeight: 'high' },
      { id: 'sin_letter_writing', name: 'ලිපි ලිවීම', order: 5, examWeight: 'high' },
      { id: 'sin_comprehension', name: 'අවබෝධ පරීක්ෂණය', order: 6, examWeight: 'high' },
      { id: 'sin_poetry', name: 'කවි', order: 7, examWeight: 'medium' },
      { id: 'sin_short_stories', name: 'කෙටි කතා', order: 8, examWeight: 'medium' },
      { id: 'sin_novel', name: 'නවකතා', order: 9, examWeight: 'medium' },
      { id: 'sin_drama', name: 'නාට්‍ය', order: 10, examWeight: 'medium' },
      { id: 'sin_summary', name: 'සාරාංශ ලිවීම', order: 11, examWeight: 'high' },
      { id: 'sin_idioms', name: 'පුවත්පත් ලිපි හා වාග් විභාග', order: 12, examWeight: 'medium' }
    ]
  },
  {
    id: 'english',
    name: 'ඉංග්‍රීසි',
    lessons: [
      { id: 'eng_grammar_tenses', name: 'කාල (Tenses)', order: 1, examWeight: 'high' },
      { id: 'eng_grammar_prepositions', name: 'පූර්ව සර්ග (Prepositions)', order: 2, examWeight: 'high' },
      { id: 'eng_vocabulary', name: 'වචන මාලාව (Vocabulary)', order: 3, examWeight: 'high' },
      { id: 'eng_reading_comprehension', name: 'කියවීම් අවබෝධය (Reading)', order: 4, examWeight: 'high' },
      { id: 'eng_writing_essays', name: 'රචනා ලිවීම (Essay Writing)', order: 5, examWeight: 'high' },
      { id: 'eng_writing_letters', name: 'ලිපි ලිවීම (Letter Writing)', order: 6, examWeight: 'high' },
      { id: 'eng_dialogue', name: 'සංවාද (Dialogue)', order: 7, examWeight: 'medium' },
      { id: 'eng_notice_writing', name: 'දැන්වීම් ලිවීම (Notices)', order: 8, examWeight: 'medium' },
      { id: 'eng_active_passive', name: 'කර්තෘ හා කර්ම (Active/Passive)', order: 9, examWeight: 'high' },
      { id: 'eng_reported_speech', name: 'වාර්තා කථනය (Reported Speech)', order: 10, examWeight: 'high' },
      { id: 'eng_conditional', name: 'කොන්දේසි වාක්‍ය (Conditionals)', order: 11, examWeight: 'medium' },
      { id: 'eng_question_tags', name: 'ප්‍රශ්න පුච්ඡ (Question Tags)', order: 12, examWeight: 'medium' }
    ]
  },
  {
    id: 'history',
    name: 'ඉතිහාසය',
    lessons: [
      { id: 'his_prehistoric', name: 'ප්‍රාග් ඓතිහාසික යුගය', order: 1, examWeight: 'medium' },
      { id: 'his_anuradhapura', name: 'අනුරාධපුර යුගය', order: 2, examWeight: 'high' },
      { id: 'his_polonnaruwa', name: 'පොළොන්නරුව යුගය', order: 3, examWeight: 'high' },
      { id: 'his_transitional', name: 'සංක්‍රාන්ති යුගය', order: 4, examWeight: 'medium' },
      { id: 'his_kotte', name: 'කෝට්ටේ යුගය', order: 5, examWeight: 'high' },
      { id: 'his_kandyan', name: 'මහනුවර යුගය', order: 6, examWeight: 'high' },
      { id: 'his_portuguese', name: 'පෘතුගීසි පාලන යුගය', order: 7, examWeight: 'high' },
      { id: 'his_dutch', name: 'ලන්දේසි පාලන යුගය', order: 8, examWeight: 'medium' },
      { id: 'his_british', name: 'බ්‍රිතාන්‍ය පාලන යුගය', order: 9, examWeight: 'high' },
      { id: 'his_independence', name: 'නිදහස් ව්‍යාපාරය', order: 10, examWeight: 'high' },
      { id: 'his_world_civilizations', name: 'ලෝක ශිෂ්ටාචාර', order: 11, examWeight: 'medium' },
      { id: 'his_modern_world', name: 'නූතන ලෝකය', order: 12, examWeight: 'low' }
    ]
  },
  {
    id: 'buddhism',
    name: 'බුද්ධ ධර්මය',
    lessons: [
      { id: 'bud_life_of_buddha', name: 'බුදුරජාණන් වහන්සේගේ ජීවිත කතාව', order: 1, examWeight: 'high' },
      { id: 'bud_four_noble_truths', name: 'චතුරාර්ය සත්‍යය', order: 2, examWeight: 'high' },
      { id: 'bud_eightfold_path', name: 'ආර්ය අෂ්ටාංගික මාර්ගය', order: 3, examWeight: 'high' },
      { id: 'bud_five_precepts', name: 'පංචශීලය', order: 4, examWeight: 'high' },
      { id: 'bud_dependent_origination', name: 'පටිච්ච සමුප්පාදය', order: 5, examWeight: 'medium' },
      { id: 'bud_kamma', name: 'කර්මය හා පුනර්භවය', order: 6, examWeight: 'high' },
      { id: 'bud_meditation', name: 'භාවනාව', order: 7, examWeight: 'medium' },
      { id: 'bud_jataka', name: 'ජාතක කතා', order: 8, examWeight: 'high' },
      { id: 'bud_sangha', name: 'සංඝ රත්නය', order: 9, examWeight: 'medium' },
      { id: 'bud_buddhist_history', name: 'බෞද්ධ ඉතිහාසය', order: 10, examWeight: 'medium' },
      { id: 'bud_pirith', name: 'පිරිත් දේශනා', order: 11, examWeight: 'low' },
      { id: 'bud_social_values', name: 'බෞද්ධ සමාජ වටිනාකම්', order: 12, examWeight: 'medium' }
    ]
  },
  {
    id: 'ict',
    name: 'තොරතුරු හා සන්නිවේදන තාක්ෂණය',
    lessons: [
      { id: 'ict_intro', name: 'තොරතුරු තාක්ෂණ හැඳින්වීම', order: 1, examWeight: 'high' },
      { id: 'ict_number_systems', name: 'සංඛ්‍යා පද්ධති', order: 2, examWeight: 'high' },
      { id: 'ict_hardware', name: 'පරිගණක දෘඩාංග', order: 3, examWeight: 'high' },
      { id: 'ict_software', name: 'පරිගණක මෘදුකාංග', order: 4, examWeight: 'high' },
      { id: 'ict_operating_systems', name: 'මෙහෙයුම් පද්ධති', order: 5, examWeight: 'medium' },
      { id: 'ict_word_processing', name: 'වදන් සැකසුම', order: 6, examWeight: 'high' },
      { id: 'ict_spreadsheets', name: 'පැතුරුම්පත්', order: 7, examWeight: 'high' },
      { id: 'ict_databases', name: 'දත්ත සමුදාය', order: 8, examWeight: 'medium' },
      { id: 'ict_presentations', name: 'ඉදිරිපත් කිරීම්', order: 9, examWeight: 'medium' },
      { id: 'ict_networking', name: 'ජාල තාක්ෂණය', order: 10, examWeight: 'high' },
      { id: 'ict_internet', name: 'අන්තර්ජාලය', order: 11, examWeight: 'high' },
      { id: 'ict_web_design', name: 'වෙබ් නිර්මාණය', order: 12, examWeight: 'medium' },
      { id: 'ict_programming', name: 'ක්‍රමලේඛනය', order: 13, examWeight: 'high' },
      { id: 'ict_cyber_security', name: 'සයිබර් ආරක්ෂාව', order: 14, examWeight: 'low' }
    ]
  },
  {
    id: 'drama',
    name: 'නාට්‍ය හා රංග කලාව',
    lessons: [
      { id: 'dra_intro', name: 'නාට්‍ය කලාව හැඳින්වීම', order: 1, examWeight: 'high' },
      { id: 'dra_history', name: 'නාට්‍ය ඉතිහාසය', order: 2, examWeight: 'medium' },
      { id: 'dra_elements', name: 'නාට්‍ය අංග', order: 3, examWeight: 'high' },
      { id: 'dra_acting', name: 'රඟපෑම', order: 4, examWeight: 'high' },
      { id: 'dra_script_writing', name: 'නාට්‍ය පිටපත් ලිවීම', order: 5, examWeight: 'high' },
      { id: 'dra_directing', name: 'අධ්‍යක්ෂණය', order: 6, examWeight: 'medium' },
      { id: 'dra_stage_design', name: 'වේදිකා සැලසුම', order: 7, examWeight: 'medium' },
      { id: 'dra_folk_drama', name: 'සාම්ප්‍රදායික නාට්‍ය', order: 8, examWeight: 'high' },
      { id: 'dra_modern_drama', name: 'නූතන නාට්‍ය', order: 9, examWeight: 'medium' },
      { id: 'dra_appreciation', name: 'නාට්‍ය අගැයීම', order: 10, examWeight: 'low' }
    ]
  },
  {
    id: 'entrepreneurship',
    name: 'ව්‍යවසායකත්ව අධ්‍යයනය',
    lessons: [
      { id: 'ent_intro', name: 'ව්‍යවසායකත්වය හැඳින්වීම', order: 1, examWeight: 'high' },
      { id: 'ent_business_ideas', name: 'ව්‍යාපාර අදහස් හඳුනාගැනීම', order: 2, examWeight: 'high' },
      { id: 'ent_market_research', name: 'වෙළඳපොළ පර්යේෂණය', order: 3, examWeight: 'high' },
      { id: 'ent_business_plan', name: 'ව්‍යාපාර සැලැස්ම', order: 4, examWeight: 'high' },
      { id: 'ent_finance', name: 'මූල්‍ය කළමනාකරණය', order: 5, examWeight: 'high' },
      { id: 'ent_marketing', name: 'අලෙවිකරණය', order: 6, examWeight: 'high' },
      { id: 'ent_production', name: 'නිෂ්පාදනය', order: 7, examWeight: 'medium' },
      { id: 'ent_human_resources', name: 'මානව සම්පත් කළමනාකරණය', order: 8, examWeight: 'medium' },
      { id: 'ent_accounting', name: 'ගිණුම්කරණය', order: 9, examWeight: 'high' },
      { id: 'ent_legal', name: 'ව්‍යාපාර නීතිය', order: 10, examWeight: 'medium' },
      { id: 'ent_ethics', name: 'ව්‍යාපාර ආචාර ධර්ම', order: 11, examWeight: 'low' }
    ]
  }
];
