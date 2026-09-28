use context starter2024
import file("/spytial.arr") as S
import js-file("/spyret-browser") as Spyret
include image

data Tree:
  | leaf(value)
  | branch(left, right)
sharing:
  method _spytial(self):
    [list:
      S.orientation("left + right", [list: S.below]),
      S.atom-style("leaf", {fill-style: S.fill-style({color: "lightblue"})})
    ]
  end
end

Spyret.diagram(branch(leaf(1), branch(leaf(2), leaf(3))))
Spyret.diagram({message: "No hook needed"})
# Explicit YAML bypasses hooks, including hooks that would fail.
Spyret.diagram({n: 9, _spytial: lam(): raise("must not run") end}, "")
circle(15, "solid", "purple")
42
