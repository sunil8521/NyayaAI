export interface EntityDefinition {
  name: string;
  aliases: string[];
  jurisdiction?: string;
}

export const KNOWN_COURTS: EntityDefinition[] = [
  {
    name: 'Supreme Court of India',
    aliases: ['supreme court of india', 'in the supreme court', 'hon\'ble supreme court', 'honble supreme court', 'apex court'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Delhi High Court',
    aliases: ['high court of delhi', 'delhi high court', 'dhc'],
    jurisdiction: 'Delhi',
  },
  {
    name: 'Bombay High Court',
    aliases: ['high court of judicature at bombay', 'bombay high court', 'bhc'],
    jurisdiction: 'Maharashtra_and_Goa',
  },
  {
    name: 'Calcutta High Court',
    aliases: ['high court at calcutta', 'calcutta high court', 'chc'],
    jurisdiction: 'West_Bengal',
  },
  {
    name: 'Madras High Court',
    aliases: ['high court of judicature at madras', 'madras high court', 'mhc'],
    jurisdiction: 'Tamil_Nadu',
  },
  {
    name: 'Allahabad High Court',
    aliases: ['high court of judicature at allahabad', 'allahabad high court', 'ahc', 'lucknow bench'],
    jurisdiction: 'Uttar_Pradesh',
  },
  {
    name: 'Karnataka High Court',
    aliases: ['high court of karnataka', 'karnataka high court', 'khc'],
    jurisdiction: 'Karnataka',
  },
  {
    name: 'Punjab and Haryana High Court',
    aliases: ['punjab and haryana high court', 'high court of punjab and haryana', 'phhc'],
    jurisdiction: 'Punjab_and_Haryana',
  },
  {
    name: 'Gujarat High Court',
    aliases: ['high court of gujarat', 'gujarat high court', 'ghc'],
    jurisdiction: 'Gujarat',
  },
  {
    name: 'Rajasthan High Court',
    aliases: ['high court of judicature for rajasthan', 'rajasthan high court', 'rhc'],
    jurisdiction: 'Rajasthan',
  },
  {
    name: 'Kerala High Court',
    aliases: ['high court of kerala', 'kerala high court', 'klhc'],
    jurisdiction: 'Kerala',
  },
  {
    name: 'Telangana High Court',
    aliases: ['high court for the state of telangana', 'telangana high court', 'tshc'],
    jurisdiction: 'Telangana',
  },
  {
    name: 'Andhra Pradesh High Court',
    aliases: ['high court of andhra pradesh', 'andhra pradesh high court', 'aphc'],
    jurisdiction: 'Andhra_Pradesh',
  },
  {
    name: 'Patna High Court',
    aliases: ['high court of judicature at patna', 'patna high court', 'phc'],
    jurisdiction: 'Bihar',
  },
  {
    name: 'Madhya Pradesh High Court',
    aliases: ['high court of madhya pradesh', 'madhya pradesh high court', 'mphc'],
    jurisdiction: 'Madhya_Pradesh',
  },
  {
    name: 'Gauhati High Court',
    aliases: ['gauhati high court', 'high court of assam'],
    jurisdiction: 'Assam_and_North_East',
  },
  {
    name: 'Orissa High Court',
    aliases: ['orissa high court', 'high court of orissa', 'ohc'],
    jurisdiction: 'Odisha',
  },
  {
    name: 'Jharkhand High Court',
    aliases: ['high court of jharkhand', 'jharkhand high court', 'jhc'],
    jurisdiction: 'Jharkhand',
  },
  {
    name: 'Chhattisgarh High Court',
    aliases: ['high court of chhattisgarh', 'chhattisgarh high court', 'cghc'],
    jurisdiction: 'Chhattisgarh',
  },
  {
    name: 'Uttarakhand High Court',
    aliases: ['high court of uttarakhand', 'uttarakhand high court', 'ukhc'],
    jurisdiction: 'Uttarakhand',
  },
  {
    name: 'Himachal Pradesh High Court',
    aliases: ['high court of himachal pradesh', 'himachal pradesh high court', 'hphc'],
    jurisdiction: 'Himachal_Pradesh',
  },
  {
    name: 'Jammu and Kashmir High Court',
    aliases: ['high court of jammu & kashmir', 'jammu and kashmir high court', 'jkhc'],
    jurisdiction: 'Jammu_and_Kashmir',
  },
];

export const KNOWN_TRIBUNALS: EntityDefinition[] = [
  {
    name: 'National Company Law Appellate Tribunal',
    aliases: ['nclat', 'national company law appellate tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'National Company Law Tribunal',
    aliases: ['nclt', 'national company law tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Income Tax Appellate Tribunal',
    aliases: ['itat', 'income tax appellate tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Debts Recovery Appellate Tribunal',
    aliases: ['drat', 'debts recovery appellate tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Debts Recovery Tribunal',
    aliases: ['drt', 'debts recovery tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'National Green Tribunal',
    aliases: ['ngt', 'national green tribunal'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Real Estate Regulatory Authority',
    aliases: ['rera', 'real estate appellate tribunal', 'real estate regulatory authority'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Competition Commission of India',
    aliases: ['cci', 'competition commission of india', 'compat'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Customs Excise and Service Tax Appellate Tribunal',
    aliases: ['cestat', 'customs excise and service tax'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Appellate Tribunal for Electricity',
    aliases: ['aptel', 'appellate tribunal for electricity'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Telecom Disputes Settlement and Appellate Tribunal',
    aliases: ['tdsat', 'telecom disputes settlement'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Central Administrative Tribunal',
    aliases: ['cat', 'central administrative tribunal'],
    jurisdiction: 'All_India',
  },
];

export const KNOWN_AUTHORITIES: EntityDefinition[] = [
  {
    name: 'Reserve Bank of India',
    aliases: ['reserve bank of india', 'rbi/'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Securities and Exchange Board of India',
    aliases: ['securities and exchange board of india', 'sebi/'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Ministry of Corporate Affairs',
    aliases: ['ministry of corporate affairs', 'mca'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Insolvency and Bankruptcy Board of India',
    aliases: ['insolvency and bankruptcy board of india', 'ibbi'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Central Board of Direct Taxes',
    aliases: ['central board of direct taxes', 'cbdt'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Central Board of Indirect Taxes and Customs',
    aliases: ['central board of indirect taxes and customs', 'cbic'],
    jurisdiction: 'All_India',
  },
  {
    name: 'Gazette of India',
    aliases: ['the gazette of india', 'gazette of india', 'egazette'],
    jurisdiction: 'All_India',
  },
];

