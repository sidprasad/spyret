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
      S.orientation("children", [list: S.direction-below]),
      S.align("siblings", S.alignment-horizontal),
      S.atom-style-with(S.default-atom-style-options
        .with-selector("leaf")
        .with-fill-style(S.default-fill-style.with-color("red")))
    ]
  end
end

data Other:
  | other(ref next)
with:
  method _spytial(self):
    [list: S.group-with("next", "family", S.default-group-options
      .with-add-edge(S.default-group-add-edge
        .with-points(S.group-edge-direction-togroup)
        .with-line-style(S.default-line-style.with-weight(1/2))))]
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
Test.collect("no-hooks", [list: 1, 2, 3])
Test.reject("invalid-return", { _spytial: lam(): 42 end })
Test.reject("invalid-size", { _spytial: lam(): [list: S.size(0, 2)] end })
Test.reject("throws", { _spytial: lam(): raise("hook failed") end })
# Constructors really carry annotations; these must fail in Pyret itself.
Test.reject("wrong-rule-type", { _spytial: lam(): [list: S.align("x", S.direction-above)] end })
Test.reject("wrong-wrapper", { _spytial: lam(): [list: S.directive(S.spytial-size(1, 2, S.default-size-options))] end })
