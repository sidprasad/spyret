import file("spytial.arr") as S
import spec-test as Test
include string-dict
include tables

fun burn(n):
  if n == 0: nothing else: burn(n - 1) end
end

data Tree:
  | leaf(n)
  | branch(children)
sharing:
  method _spytial(self) -> List<S.SpytialRule> block:
    burn(20000)
    [list:
      S.orientation("children", [list: S.below]),
      S.align("siblings", S.horizontal),
      S.atom-style("leaf", {fill-style: S.fill-style({color: "red"})}),
      S.edge-style("children", {line-style: S.line-style({pattern: S.dashed})})
    ]
  end
end

data Other:
  | other(ref next)
with:
  method _spytial(self):
    [list: S.group-with("next", "family", {add-edge: S.group-add-edge({
      points: S.togroup,
      line-style: S.line-style({weight: 1/2})
    })})]
  end
end

a = leaf(1)
b = other(nothing)
b!{next: b}
# Root has no hook; another Tree instance has a new descendant type.
Test.collect("nested", [raw-array: a, a, branch([list: a, b])])
Test.collect("dict", [string-dict: "tree", a, "cycle", b])
Test.collect("table", table: value row: a row: b end)
Test.collect("tuple", {a; b})
Test.collect("raw", { _spytial: lam(): "directives: []" end })
Test.collect("paused", { _spytial: lam() block:
  Test.pause()
  [list: S.hide-field("internal")]
end })
Test.collect("empty", { _spytial: lam(): [list: ] end })
Test.collect("short-enum", { _spytial: lam(): [list: S.orientation("next", [list: S.right])] end })
Test.collect("sparse-style", { _spytial: lam(): [list:
  S.atom-style("leaf", {show-label: false})] end })
Test.collect("no-hooks", [list: 1, 2, 3])
Test.reject("invalid-return", { _spytial: lam(): 42 end })
Test.reject("invalid-size", { _spytial: lam(): [list: S.size(0, 2)] end })
Test.reject("unknown-style-field", { _spytial: lam(): [list:
  S.atom-style("leaf", {fill-style: S.fill-style({colour: "red"})})] end })
Test.reject("wrong-style-block", { _spytial: lam(): [list:
  S.edge-style("children", {line-style: S.text-style({color: "red"})})] end })
Test.reject("throws", { _spytial: lam(): raise("hook failed") end })
# Constructors really carry annotations; these must fail in Pyret itself.
Test.reject("wrong-rule-type", { _spytial: lam(): [list: S.align("x", S.above)] end })
Test.reject("wrong-wrapper", { _spytial: lam(): [list: S.directive(S.spytial-size(1, 2, {}))] end })
