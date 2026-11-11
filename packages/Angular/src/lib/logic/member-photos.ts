/** A user's own photo, as MJ keeps it and MJ's chat draws it. */
export interface UserPhotoRow {
    ID: string;
    UserImageURL?: string | null;
}

/** The photo on the People record linked to a user. */
export interface PersonPhotoRow {
    LinkedUserID?: string | null;
    PhotoURL?: string | null;
}

/**
 * Each member's photo, by lower-case user ID. A user's own photo comes first, so staff see the picture MJ's chat shows.
 * The photo on the person's People record fills in where the user has none or the reader may not read that user: an
 * outside participant reads only their own user, and reads the People records of everyone they share a space with.
 * A member with neither has no entry and is drawn as initials.
 */
export function photosByUser(users: readonly UserPhotoRow[], people: readonly PersonPhotoRow[]): Map<string, string> {
    const photos = new Map<string, string>();
    for (const person of people) {
        if (person.LinkedUserID && person.PhotoURL) photos.set(person.LinkedUserID.toLowerCase(), person.PhotoURL);
    }
    for (const user of users) {
        if (user.UserImageURL) photos.set(user.ID.toLowerCase(), user.UserImageURL);
    }
    return photos;
}
