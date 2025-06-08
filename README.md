# EuBrowser

Would this make a good ai friendly project overview brief?

project_name: EU-Law Platform (MVP)

purpose: >
Web application that lets lawyers search, browse, analyse, and export
EU legislation, individual articles, case-law documents, and operative
parts, all held in a Supabase (PostgreSQL) database.

database_schema:
tables:
legislations:
key_fields: [celex_number, title, full_markdown_content]
articles:
key_fields: [legislation_id, article_number_text, title, filename, markdown_content]
case_laws:
key_fields: [celex_number, case_id_text, title, court, date_of_judgment,
parties, summary_text, operative_parts_combined,
operative_parts_individual, html_content, plaintext_content]
operative_parts:
key_fields: [case_law_id, part_number, verbatim_text, simplified_text, markdown_content]
junction_tables:
- case_law_interprets_article
- operative_part_interprets_article
- operative_part_mentions_legislation
relationships:
- legislations 1–* articles
- articles *–* case_laws
- case_laws 1–* operative_parts
- operative_parts *–* articles
- operative_parts *–* legislations
special_field:
simplified_text: “reader-friendly version of each operative part”

user_workflows:
research:
- discovery   # search
- analysis    # open detail + follow links
- compilation # build filtered report
- export
browsing:
- open_legislation_overview
- drill_down_to_article
- open_related_cases
- traverse_via_sidebar_links

pages_components:

- id: global_search
  description: “Full-text query across all entity types”
- id: legislation_view
  description: “Metadata, full text, list of articles, cases by article”
- id: article_view
  description: “Article text plus related cases and operative parts”
- id: case_law_view
  description: “Case metadata, summary, operative parts with toggle”
- id: operative_part_toggle
  description: “Switch simplified ↔ verbatim text”
- id: report_builder
  description: “Select legislation/article, filter cases, export data”

features:
global_search:
inputs:  [query_string]
outputs: [result_cards]
display_fields: [content_type, title, text_snippet, simplified_text_toggle]
notes: “No advanced filtering in search interface”
document_views:
- legislation_view
- article_view
- case_law_view
related_items_display:
relationships_shown:
- cases_interpreting_article_or_legislation
- articles_referenced_by_case
- legislations_mentioned_in_operative_part
report_generation:
target_scope: [entire_legislation, specific_articles]
filters: [date_range, court, case_outcome]
export_formats: [CSV, HTML, Word, PDF]
export_content_options:
- simplified_operative_parts
- full_operative_parts
- complete_case_text
- case_links_only
toggle_affects: “entire results list”

performance_requirements:
search_results_ms: 2000   # ≤ 2 s
progressive_document_load: true
export_progress_indicator: true
pagination_threshold: 50  # paginate result sets larger than this

ui_elements:
globals:
- persistent_search_bar
- breadcrumb_navigation
- related_items_sidebar
toggles:
- simplified_vs_full_text
indicators:
- content_type_badge
export_button: true
toc_in_case_view: true     # headings levels 1–3

content_display_rules:
default_operatives: simplified_text
case_lists_order: recent_first
article_lists_order: numerical
related_items_grouped: true

export_table_structure:
columns:
- case_number
- parties
- court
- date
- operative_part_text   # controlled by toggle
sortable_columns: [date, court, case_number]

acceptance_checks:

- “Search returns mixed entity types with correct badges”
- “Toggle switches between simplified and verbatim without re-query”
- “CSV opens in Excel without column misalignment”
- “HTML report preserves hyperlinks to platform detail pages”
