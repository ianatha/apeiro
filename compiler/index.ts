import babel, {
  NodePath,
  types as t,
} from "https://esm.sh/@babel/core@7.18.13";

import { Expression, ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier, PrivateName } from "https://esm.sh/v92/@babel/types@7.18.13/lib/index-legacy.d.ts";
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

function callThroughContext(
  node: CallExpression,
) {
  const callee = node.callee as Expression;

  if (callee.type === "MemberExpression" && callee.object.name == "$ctx") {
    return node;
  }

  let target: Expression = t.numericLiteral(0);
  let identifier: Expression | PrivateName = callee;
  if (callee.type === "MemberExpression") {
    target = callee.object;
    identifier = callee.property;
  }

  return t.callExpression(
    t.memberExpression(
      t.identifier("$ctx"),
      t.identifier("call"),
    ),
    [
      target,
      identifier as Expression,
      ...node.arguments,
    ]
  )
}

function explodeFunctionCalls(frameIndex: number) {
  return {
    CallExpression(path: NodePath<CallExpression>) {
      if (
        !path.parentPath.isExpressionStatement() &&
        !path.parentPath.isVariableDeclarator() &&
        !path.parentPath.isAssignmentExpression()
      ) {
        if (
          path.isCallExpression() &&
          path.node.callee?.type === "Identifier" &&
          path.node.callee.name.indexOf("$ctx.") == 0 &&
          path.node.callee.name.indexOf("$ctx.call") != 0
         ) {
          return;
        }
        const newVar = path.scope.generateUidIdentifierBasedOnNode(path.node)
        path.getStatementParent()?.insertBefore(
          [t.expressionStatement(
            t.assignmentExpression("=",
              t.identifier("$f" + frameIndex + ".s." + newVar.name),
              callThroughContext(path.node)
            )
          ),
        ]);
        path.getStatementParent()?.insertAfter(
          t.expressionStatement(
          t.unaryExpression(
            "delete",
            t.identifier("$f" + frameIndex + ".s." + newVar.name),
          ))
        );

        path.replaceWith(t.identifier("$f" + frameIndex + ".s." + newVar.name));
      } else {
        path.replaceWith(callThroughContext(path.node));
        // path.skip();
      }
    },
  };
}

const introduceContext = {
  FunctionDeclaration(path: NodePath<FunctionDeclaration>) {
    path.node.params.unshift(t.identifier("$ctx"));
    const functionNameIdentifier = path.node.id!;
    path.insertAfter(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          t.memberExpression(
            functionNameIdentifier,
            t.identifier("$apeiro_func")
          ),
          t.booleanLiteral(true)
        )
      )
    );
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
  path: NodePath<BlockStatement>,
  frameIdentifier: Identifier,
) {
  for (const binding of Object.values(path.scope.bindings)) {
    if (binding.path.isVariableDeclarator()) {
      binding.path.parentPath.replaceWith(
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
      path.scope.rename(binding.identifier.name, frameIdentifier.name + ".s." + binding.identifier.name);

      // binding.referencePaths.forEach((refPath) => {
      //   refPath.replaceWith(
      //     t.identifier(frameIdentifier.name + ".s." + binding.identifier.name),
      //   );
      //   // TODO: workaround
      //   if (refPath.parentPath?.parentPath?.isAssignmentExpression()) {
      //     refPath.parentPath.parentPath.node.left = t.identifier(
      //       frameIdentifier.name + ".s." + binding.identifier.name,
      //     );
      //   }
      // });
      // binding.path.remove();
    }
  }
}

const importSpecifierToName = function(specifier: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier) {
  if (specifier.type == "ImportSpecifier") {
    if (specifier.imported.type == "Identifier") {
      return specifier.imported.name;
    } else {
      return specifier.imported.value;
    }
  } else if (specifier.type == "ImportDefaultSpecifier") {
    return "default";
  } else if (specifier.type == "ImportNamespaceSpecifier") {
    return specifier.local.name;
  }
}

const importDeclarationVisitor = {
  ImportDeclaration(path: NodePath<ImportDeclaration>) {
    if (path.node.source.value.indexOf("pristine://") != 0) {
      return;
    }
    
    const [ _, pristinePath ] = path.node.source.value.split("pristine://");
    const pristinePathParts = pristinePath.split("/");
    path.node.specifiers.map((specifier) => {
      const binding = path.scope.getBinding(specifier.local.name);
      if (binding) {
        binding.referencePaths.forEach((refPath) => {
          const importedName = importSpecifierToName(specifier);

          refPath.replaceWith(
            t.callExpression(
              t.identifier("$ctx.getFunction"),
              [
                ...pristinePathParts.map((part) => t.stringLiteral(part)),
                t.stringLiteral(specifier.imported.name),
              ]
            )
          );
        });
      }
    });
    path.remove();
  }
};

function transform(code) {
  const output = babel.transformSync(code, {
    plugins: [
      function apeiroInstrumentationPlugin() {
        return {
          visitor: {
            ...introduceContext,
            ...importDeclarationVisitor,
            BlockStatement(path: NodePath<BlockStatement>) {
              const frameIndex = assignFrameIndex(path);
              path.traverse(explodeFunctionCalls(frameIndex));
              const [frameIdentifier, frameDeclaration] = generateFrameDeclaration(path, frameIndex);
              rewriteBindingsToFrameState(path, frameIdentifier);
              path.node.body = functionBodyToSwitch(frameDeclaration, path);
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

function functionBodyToSwitch(frameDeclaration: VariableDeclaration, path: babel.NodePath<BlockStatement>): Statement[] {
  return [
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
                  t.identifier(`$f${path.getData("frame")}.pc`)
                )
              ),
            ]
          )
        );
        return newBody;
      }, [] as SwitchCase[])
    ),
    frameEndDeclaration(path),
  ];
}
