# MCA XBRL Tool — IND-AS

The repository's published web application is MCA IND-AS XBRL Workbench V4.

Open the live IND-AS V4 workbench: ./IND_AS_V4/

## Current release

V4 adds a structured local rule engine over the supplied MCA IND-AS Taxonomy V1.2 and Business Rules V1.2. It executes deterministic portions of 818 concept-specific business-rule rows, including conditional mandatory checks, numeric/date constraints, cross-concept percentage/equality relationships, NotAll dimensional exclusions, dimensional mandatory-line propagation, sequential numbered-member checks and embedded-image restrictions.

The MCA XBRL Validation Tool and pre-scrutiny process remain the final authority for complete validation. No GitHub release here should be treated as MCA certification.

## Release organization

IND_AS_V4/ is the current deployable IND-AS release. The repository root retains the prior V3 application assets for reference, while the GitHub Pages entry point redirects to V4.