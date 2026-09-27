# Space Types Metadata

## Authorization Requirements

Every Space Type create, update, and delete requires the **Configure Space Types** authorization under the **Collaboration** root authorization tree. 

In MemberJunction, this authorization is granted to the `Developer` role (see `metadata/authorization-roles/.authorization-roles.json`). 

Consequently, executing metadata push commands such as:
```bash
mj sync push --dir=metadata
```
must be run as a user holding the `Developer` role in order to successfully push and synchronize Space Types records.
