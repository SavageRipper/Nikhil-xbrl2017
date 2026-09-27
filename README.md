# MCA IND-AS XBRL Workbench V3

A separate IND-AS filing-preparation and XML-generation workbench based on the supplied MCA IND-AS Taxonomy V1.2, Business Rules for IndAS Taxonomy V1.2 and MCA IND-AS Filing Manual V1.0. V1 and V2 are preserved as prior releases.

## V3 release focus

V3 adds an executable local rule-preflight layer on top of the V2 taxonomy engine. It evaluates machine-interpretable portions of the supplied concept-specific business-rule text, including:

- unconditional mandatory concepts/tables where applicable;
- conditional mandatory rules when a related concept is populated;
- non-negative / non-positive numeric constraints;
- percentage/value upper limits such as 100%;
- system-date upper bounds;
- age >= 18 date rule;
- taxonomy `NotAll` dimensional exclusions;
- duplicate fact/context detection;
- calculation-linkbase consistency;
- opening/closing continuity;
- dimensional axis/member/default-member checks;
- INR and monetary decimal constraints.

V3 keeps the XML generation gate: blocking local preflight errors prevent XML generation. The MCA XBRL Validation Tool remains the final authority for complete schema, formula, business-rule and pre-scrutiny validation.

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

`index.html` + `app.js` + `data/indas-data.json` + `styles.css` are a static local-first application suitable for GitHub Pages. The original MCA source packages are retained under `reference/`.

The taxonomy model remains the structural source of truth: presentation linkbases drive ordinary fact entry, definition linkbases drive dimensions, calculation linkbases drive consistency, and the supplied business-rule package drives executable preflight where the rule text is machine-interpretable.

## Running

Serve this folder over HTTP, for example:

```bash
python -m http.server 8000
```

Then open the displayed local server address in a browser.

## Validation limitation

No release in this repository should be interpreted as a claim of MCA Validator certification. The MCA XBRL Validation Tool and pre-scrutiny process remain the final validation authority. V3 is designed to reduce avoidable local errors and provide a more faithful preparation workflow before external MCA validation.