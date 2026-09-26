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
      S.orientation("left + right", [list: S.direction-below]),
      S.atom-style-with(S.default-atom-style-options
        .with-selector("leaf")
        .with-fill-style(S.default-fill-style.with-color("lightblue")))
    ]
  end
end

Spyret.show(branch(leaf(1), branch(leaf(2), leaf(3))))
Spyret.show({message: "No hook needed"})
circle(15, "solid", "purple")
42
