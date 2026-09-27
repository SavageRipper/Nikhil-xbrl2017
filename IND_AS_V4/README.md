# MCA IND-AS XBRL Workbench V4

A separate IND-AS filing-preparation and XML-generation workbench based on the supplied MCA IND-AS Taxonomy V1.2, Business Rules for IndAS Taxonomy V1.2 and MCA IND-AS Filing Manual V1.0. The IND-AS tool is maintained independently from the earlier C&I tool and V1/V2/V3 releases.

## V4 release focus

V4 upgrades the V3 preflight layer into a structured rule engine. The engine compiles the supplied 818 concept-specific rule rows into deterministic descriptors containing applicability predicates, mandatory conditions, numeric/date constraints and cross-concept relationships wherever those semantics can be inferred safely from the supplied rule text. It also executes selected generic business rules directly.

Implemented V4 rule-engine capabilities include:

- unconditional and conditional mandatory concept/table checks;
- Yes/No and populated/not-populated trigger conditions;
- numeric comparisons such as greater-than-zero and non-negative constraints;
- percentage relationships such as 2% of another concept when explicitly stated;
- date upper-bound and age constraints;
- supplied MCA country/currency list membership checks where the rule is list-driven;
- 4/8-digit code-format checks where explicitly stated;
- symmetric mandatory / corresponding-field relationships;
- taxonomy `NotAll` dimensional exclusions;
- dimensional mandatory-line-item propagation for populated member combinations;
- sequential numbered-member checks;
- rejection of embedded images/graphics in escaped XHTML facts;
- duplicate fact/context, calculation-linkbase and opening/closing continuity checks already present in V3;
- an XML-generation gate that blocks output while blocking local preflight errors remain.

The parser deliberately leaves ambiguous rule text in advisory status rather than inventing a deterministic interpretation. Each executable finding keeps the source rule ID and original rule text for traceability.

## Source coverage

- 5,647 taxonomy concepts
- 66 presentation ELRs
- 7,319 presentation relationships
- 5,167 definition/dimensional relationships
- 1,286 calculation relationships
- 818 concept-specific business-rule rows
- 16 generic business rules
- 108 mandatory-line-item definitions
- 71 `NotAll` relationships
- 70 dimension-default relationships
- 36 opening/closing formula groups

## Architecture

`index.html` + `app.js` + `rule-engine.js` + `data/indas-data.json` + `styles.css` form a static local-first application suitable for GitHub Pages. The original MCA source packages remain under `reference/`.

The taxonomy model remains the structural source of truth: presentation linkbases drive ordinary fact entry, definition linkbases drive dimensions, calculation linkbases drive consistency, and the supplied business-rule package drives executable preflight where the rule text is machine-interpretable.

## Running

Serve this folder over HTTP, for example:

```bash
python -m http.server 8000
```

Then open the displayed local server address in a browser.

## Test fixtures

`tests/test_rule_engine.mjs` exercises conditional mandatory rules, fuzzy concept-reference resolution for known source-text spelling variants, non-negative constraints, percentage relationships, generic image restrictions and `NotAll` dimensional enforcement.

## Validation limitation

No release in this repository should be interpreted as a claim of MCA Validator certification. The MCA XBRL Validation Tool and pre-scrutiny process remain the final validation authority. V4 is designed to reduce avoidable preparation errors and provide a traceable local rule execution layer before external MCA validation.