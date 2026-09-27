import json, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((root/"data"/"indas-data.json").read_text(encoding="utf-8"))
emap={e["q"] for e in d["elements"]}
assert len(emap)==d["meta"]["elementCount"]
assert all(x["q"] in emap for x in d["presentation"])
assert all(x["from"] in emap and x["to"] in emap for x in d["definitions"])
assert all(x["from"] in emap and x["to"] in emap for x in d["calculations"])
roles={x["role"] for x in d["elrs"]}
assert all(x["role"] in roles for x in d["presentation"])
assert all(a["q"] in emap for r in d["elrs"] for a in r["axes"])
defaults={(x["from"],x["to"]) for x in d["definitions"] if x["arcrole"].endswith("dimension-default")}
assert defaults
print("PASS: normalized taxonomy model integrity")
print("concepts",len(emap),"ELRs",len(roles),"presentation",len(d["presentation"]),"definitions",len(d["definitions"]),"calculations",len(d["calculations"]))