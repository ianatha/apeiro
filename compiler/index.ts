import babel, {
  NodePath,
  types as t,
} from "https://esm.sh/@babel/core@7.18.13";
import {
  BlockStatement,
  CallExpression,
  FunctionDeclaration,
  Identifier,
  Statement,
  SwitchCase,
  VariableDeclaration,
  ImportDeclaration
} from "https://esm.sh/v96/@babel/types@7.19.3/lib/index-legacy.d.ts";

function explodeFunctionCalls(frameIndex: number) {
  return {
    CallExpression(path: NodePath<CallExpression | Identifier>) {
      if (
        !path.parentPath.isExpressionStatement() &&
        !path.parentPath.isVariableDeclarator() &&
        !path.parentPath.isAssignmentExpression()
      ) {
        const newVar = path.scope.generateUidIdentifierBasedOnNode(path.node)
        path.getStatementParent()?.insertBefore(
          [t.expressionStatement(
            t.assignmentExpression("=",
              t.identifier("$f" + frameIndex + ".s." + newVar.name),
              path.node)
          ),
        ]).forEach((s) => s.skip());
        path.getStatementParent()?.insertAfter(
          t.expressionStatement(
          t.unaryExpression(
            "delete",
            t.identifier("$f" + frameIndex + ".s." + newVar.name),
          ))
        );

        path.replaceWith(t.identifier("$f" + frameIndex + ".s." + newVar.name));
      }
    },
  };
}

const introduceContext = {
  FunctionDeclaration(path: NodePath<FunctionDeclaration>) {
    path.node.params.unshift(t.identifier("$ctx"));
  },
};

function assignFrameIndex(path: NodePath<Statement>): number {
  const parentWithIndex = path.findParent((p) =>
    p.getData("frame") !== undefined
  );
  if (parentWithIndex) {
    const parentFrameIndex = parentWithIndex.getData("frame");
    path.setData("frame", parentFrameIndex + 1);
    return parentFrameIndex + 1;
  } else {
    path.setData("frame", 0);
    return 0;
  }
}

function generateFrameDeclaration(
  path: NodePath<Statement>,
  frameIndex: number,
): [Identifier, VariableDeclaration] {
  const frameInvocation = (path.getData("frame") == 0)
    ? t.identifier("$ctx.frame()")
    : t.identifier(`$f${path.getData("frame") - 1}.subframe()`);

  const frameIdentifier = t.identifier("$f" + frameIndex);
  const frameDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(
      frameIdentifier,
      frameInvocation,
    ),
  ]);

  return [frameIdentifier, frameDeclaration];
}

function frameEndDeclaration(path: NodePath<Statement>) {
  return t.expressionStatement(
    t.callExpression(
      t.identifier("$f" + path.getData("frame") + ".end"),
      [],
    ),
  );
}

function rewriteBindingsToFrameState(
  path: NodePath<Statement>,
  frameIdentifier: Identifier,
) {
  for (const binding of Object.values(path.scope.bindings)) {
    if (binding.path.isVariableDeclarator()) {
      binding.path.parentPath.insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            "=",
            t.identifier(
              frameIdentifier.name + ".s." + binding.identifier.name,
            ),
            binding.path.node.init,
          ),
        ),
      );
      binding.referencePaths.forEach((refPath) => {
        refPath.replaceWith(
          t.identifier(frameIdentifier.name + ".s." + binding.identifier.name),
        );
        // TODO: workaround
        if (refPath.parentPath?.parentPath?.isAssignmentExpression()) {
          refPath.parentPath.parentPath.node.left = t.identifier(
            frameIdentifier.name + ".s." + binding.identifier.name,
          );
        }
      });
      binding.path.remove();
    }
  }
}

function transform(code) {
  const output = babel.transformSync(code, {
    plugins: [
      function apeiroInstrumentationPlugin() {
        return {
          visitor: {
            ...introduceContext,
            BlockStatement(path: NodePath<BlockStatement>) {
              const frameIndex = assignFrameIndex(path);
              path.traverse(explodeFunctionCalls(frameIndex));
              const [frameIdentifier, frameDeclaration] =
                generateFrameDeclaration(path, frameIndex);
              rewriteBindingsToFrameState(path, frameIdentifier);
              path.node.body = [
                frameDeclaration,
                t.switchStatement(
                  t.identifier(`$f${path.getData("frame")}.pc`),
                  path.node.body.reduce((newBody, statement, i) => {
                    newBody.push(
                      t.switchCase(
                        t.numericLiteral(i),
                        [
                          statement,
                          t.expressionStatement(
                            t.updateExpression(
                              "++",
                              t.identifier(`$f${path.getData("frame")}.pc`),
                            ),
                          ),
                        ],
                      ),
                    );
                    return newBody;
                  }, [] as SwitchCase[]),
                ),
                frameEndDeclaration(path),
              ];
            },
          },
        };
      },
    ],
  });
  return output?.code;
}

let res = "";
const buf = new Uint8Array(1024);
while (true) {
  const n = await Deno.stdin.read(buf);
  if (n !== null) {
    res = res + new TextDecoder().decode(buf.subarray(0, n));
  } else {
    console.log(transform(res));
    Deno.exit(0);
  }
}
