# Bad

## Section

[dead file](references/gone.md)
[dead anchor](#no-such-heading)
[dead titled link](references/gone2.md "title")
[dead angle](<references/gone3.md>)
[dead cross-anchor](references/ok.md#not-there)
<a href="references/gone4.md">dead html link</a>
<img src="references/gone5.png">

[deadref]: references/gone6.md

See `ok.md` §GhostBacktick for details.
See [`ok.md`](references/ok.md) §GhostLinked for details.
See ok.md §GhostBare for details.
See `wrong/path/ok.md` §Alive for details.
The `never-existed.mjs` script runs it.
Run never-existed-too.mjs to sync.
The `ghost-lib.sh` helper runs it.

~~~markdown
## Phantom heading in a tilde fence
~~~
[link to the phantom](#phantom-heading-in-a-tilde-fence)

````markdown
## A heading that only exists inside a backtick fence
````
[dead anchor to a backtick-fenced heading](#a-heading-that-only-exists-inside-a-backtick-fence)

```yaml
key: value
   ```

[dead link after an indented closing fence](references/gone7.md)

[dead anchor in an uppercase-stemmed file](references/Guide.md#not-a-heading)
[dead uppercase-stemmed file](references/GONE8.md)
See `Guide.md` §Ghostly for details.

<a href="references/ok.md#no-such-fragment">dead fragment in an HTML href</a>

[deadfrag]: references/ok.md#also-no-such-fragment

[dead anchor to a setext heading that does not exist](#setext-ghost)
[dead anchor near a duplicate heading](#alive-2)
[dead emoji anchor](#deploy-it)
[wrong-case path](References/ok.md)

[dead link in the same directory](gone-sibling.md)
[dead anchor needing a backtick strip](#a-code-heading)
[dead H1 anchor](#not-the-h1)
<h2 id="real-id">has an id</h2>
[dead anchor despite an id nearby](#not-that-id)
See `nowhere.md` §Anything for details.
See `ok.md` §3 for details.
The `ghost-script.py` tool runs it.

<!-- first comment -->
[a dead link between two comments](references/gone9.md)
<!-- second comment -->

See PRD §8 for the requirement.

These 99 rules apply to everything.

The 9 release-only checks fire at release time.

[placeholder path, must be skipped](../stories/US-X.Y-<slug>.md)
[placeholder epic, skipped](../epics/EPIC-N.md)
[a consumer doc, not ours](../../DESIGN.md)
The `foo.sh` illustration is not a real script.
[glob path, must be skipped](tests/*.spec.ts)
The `Next.js` framework is a product name, not a script.

```yaml
an unclosed fence runs to end of file
