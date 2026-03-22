<script>
/* ============================================================
   LOAN SEARCH PAGE - Before </body> Tag (v4.5)
   
   Loads the external loan search script from the dedicated
   Cloudflare Worker (mtg-broker-loan-search).
   
   v4.5: Updated version param to v7.7.1 (NEXA product gating fix)
   v4.4: Updated version param to v7.6 (logos, columns panel, clear states)
   v4.3: v7.5 (default columns only)
   v4.2: v7.4.1 (accordion filters)
   v4.1: v7.4.0 (side panel filters)
   v4.0: Points to dedicated loan search worker
   ============================================================ */
(function() {
  console.log('Loading Loan Search v7.7...');
  
  var script = document.createElement('script');
  script.src = 'https://mtg-broker-loan-search.rich-e00.workers.dev/loan-search.js?v=7.7.1';
  
  script.onload = function() {
    console.log('✅ Loan search script v7.7 loaded');
  };
  
  script.onerror = function() {
    console.error('❌ Failed to load loan search script');
    var loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = 'Failed to load. Please refresh the page.';
    }
  };
  
  document.body.appendChild(script);
})();
</script>
