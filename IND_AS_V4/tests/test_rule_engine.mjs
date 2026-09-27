import fileSystem from 'fs';
import assert from 'assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Engine = require('../rule-engine.js');
const data = JSON.parse(fileSystem.readFileSync(new URL('../data/indas-data.json', import.meta.url), 'utf8'));
const compiled = Engine.compile(data);

assert.equal(compiled.stats.total, 818);
assert.ok(compiled.stats.conditional >= 250);
assert.ok(compiled.stats.constraints >= 250);

function state(facts={}, dimRows={}, profile={nature:'Standalone', firstYear:false}) {
  return { facts, dimRows, profile };
}
function findings(s) { return Engine.evaluate(compiled, data, s); }
function hasRule(fs,id) { return fs.some(x=>x.ruleId===id); }
function rule(fs,id) { return fs.filter(x=>x.ruleId===id); }

// Conditional mandatory: Yes trigger -> target required.
let fs = findings(state({
  'ind-as:WhetherCompanyHasOtherComprehensiveIncomeOCIComponentsPresentedNetOfTax|current':'Yes'
}));
assert.ok(hasRule(fs, 'specific:ind-as:OtherComprehensiveIncome'), 'Yes-triggered conditional mandatory should fire');

// Same rule with No trigger should not fire.
fs = findings(state({
  'ind-as:WhetherCompanyHasOtherComprehensiveIncomeOCIComponentsPresentedNetOfTax|current':'No'
}));
assert.ok(!hasRule(fs, 'specific:ind-as:OtherComprehensiveIncome'), 'No trigger should suppress conditional mandatory');

// Numeric conditional: amount required when companion share count is entered.
fs = findings(state({
  'in-ca:NumberOfSharesIssuedInOtherPrivatePlacement|current':'100'
}));
assert.ok(rule(fs,'specific:ind-as:AmountOfOtherPrivatePlacementIssueDuringPeriod').length >= 1);

// Non-negative constraint.
fs = findings(state({
  'ind-as:PropertyPlantAndEquipment|current':'-1',
  'ind-as:PropertyPlantAndEquipment|prior':'1'
}));
assert.ok(rule(fs,'specific:ind-as:PropertyPlantAndEquipment').some(x=>/at least 0/.test(x.message)));

// Percentage relationship: 2% of average net profit when average > 0.
fs = findings(state({
  'ind-as:WhetherProvisionsOfCorporateSocialResponsibilityAreApplicableOnCompany|current':'Yes',
  'ind-as:AverageNetProfitForLastThreeFinancialYears|current':'1000',
  'ind-as:PrescribedCSRExpenditure|current':'20'
}));
assert.ok(!rule(fs,'specific:ind-as:PrescribedCSRExpenditure').some(x=>/percentage relationship/.test(x.message)));
fs = findings(state({
  'ind-as:WhetherProvisionsOfCorporateSocialResponsibilityAreApplicableOnCompany|current':'Yes',
  'ind-as:AverageNetProfitForLastThreeFinancialYears|current':'1000',
  'ind-as:PrescribedCSRExpenditure|current':'10'
}));
assert.ok(rule(fs,'specific:ind-as:PrescribedCSRExpenditure').some(x=>/percentage relationship/.test(x.message))); 

// Generic rule 4: embedded graphics are rejected.
fs = Engine.evaluateGeneric(data, state({'ind-as:DetailsOfSomeEscapedText|current':'<p>ok</p><img src="data:image/png;base64,abc">'}));
assert.ok(fs.some(x=>x.ruleId==='generic:4'));

// Taxonomy NotAll enforcement.
const notAll = data.definitions.find(x=>x.arcrole.endsWith('/notAll'));
assert.ok(notAll, 'Expected at least one NotAll arc');
const role = notAll.role;
fs = [];
Engine.evaluateNotAll(data, state({}, {[role]:[{line:notAll.from,dims:{},current:'1',prior:''}]}), (level,message,concept,meta)=>fs.push({level,message,concept,meta}));
assert.ok(fs.some(x=>x.concept===notAll.from));

// Fuzzy reference resolution: the supplied rule has a known spelling variant for "Discontinued".
const fuzzy = compiled.rules.find(x=>x.q==='ind-as:TaxExpenseOfDiscontinuedOperations');
assert.ok(fuzzy.conditions.some(c=>c.ref==='ind-as:ProfitLossFromDiscontinuedOperationsBeforeTax'));

console.log('Rule-engine fixture tests passed:', compiled.stats);