const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs');

// Chambers to scrape with their directory URLs
const chambers = [
  { id: 'qualicum-beach-chamber', name: 'Qualicum Beach', url: 'https://www.qualicumbeachchamber.com/member-directory' },
  { id: 'port-alberni-chamber', name: 'Alberni Valley', url: 'https://www.avcoc.com/business-directory' },
  { id: 'sooke-chamber', name: 'Sooke', url: 'https://www.sookeregion chamber.com/business-directory' },
  { id: 'sidney-chamber', name: 'Sidney', url: 'https://www.sidneybia.ca/directory' },
  { id: 'ladysmith-chamber', name: 'Ladysmith', url: 'https://www.ladysmithchamber.com/directory' },
  { id: 'ucluelet-chamber', name: 'Ucluelet', url: 'https://www.ucluelet.ca/directory' },
  { id: 'port-hardy-chamber', name: 'Port Hardy', url: 'https://www.ph-chamber.bc.ca/directory' },
  { id: 'chemainus-chamber', name: 'Chemainus', url: 'https://www.chemainus.bc.ca/business-directory' },
  { id: 'cowichan-lake-chamber', name: 'Cowichan Lake', url: 'https://www.cowichanlake.ca/directory' },
  { id: 'port-mcneill-chamber', name: 'Port McNeill', url: 'https://www.portmcneill.ca/directory' },
  { id: 'pender-island-chamber', name: 'Pender Island', url: 'https://www.penderislandchamber.com/directory' },
  { id: 'alert-bay-chamber', name: 'Alert Bay', url: 'https://www.alertbay.ca/directory' },
  { id: 'port-renfrew-chamber', name: 'Port Renfrew', url: 'https://www.portrenfrew.com/directory' }
];

console.log('Looking up correct URLs for remaining VI chambers...');

// Let me first search for correct URLs
