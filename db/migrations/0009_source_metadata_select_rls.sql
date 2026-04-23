CREATE POLICY source_pages_select_own
  ON source_pages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM response_citations rc
      JOIN tracking_projects tp ON tp.id = rc.project_id
      WHERE rc.source_page_id = source_pages.id
        AND tp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY source_domains_select_own
  ON source_domains FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM source_pages sp
      JOIN response_citations rc ON rc.source_page_id = sp.id
      JOIN tracking_projects tp ON tp.id = rc.project_id
      WHERE sp.domain_id = source_domains.id
        AND tp.user_id = (SELECT auth.uid())
    )
  );
