import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrustRoom AI — AI-supervised escrow for P2P deals',
  description:
    'Negotiate high-risk P2P deals over voice/video with realtime AI fraud monitoring, Solana escrow, and tamper-evident evidence.',
};

// Inline script to strip browser-extension-injected attributes before React hydrates.
// Bis extension injects bis_skin_checked, bis_register, __processed_* etc.
// Must run synchronously in <head> with MutationObserver to catch early injections.
const STRIP_EXT_ATTRS_SCRIPT = `
(function(){
  try {
    var ATTRS=['bis_skin_checked','bis_register'];
    var PREFIX='__processed_';
    function strip(el){
      for(var i=0;i<ATTRS.length;i++) el.removeAttribute(ATTRS[i]);
      for(var j=el.attributes.length-1;j>=0;j--){
        if(el.attributes[j].name.indexOf(PREFIX)===0) el.removeAttribute(el.attributes[j].name);
      }
    }
    var obs=new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        if(muts[i].type==='attributes') strip(muts[i].target);
      }
    });
    obs.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:ATTRS.concat(['bis_register'])});
  } catch(e){}
})();
`.replace(/\n/g, ' ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXT_ATTRS_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
